var DataManager = (function() {
    var fso = null;
    var lastReplayTs = 0;
    var lastArchiveTs = 0;

    function initFSO() {
        if (fso) return true;
        try {
            fso = new ActiveXObject("Scripting.FileSystemObject");
            return true;
        } catch (e) {
            return false;
        }
    }

    function getJsonPath(cat) {
        if (typeof SHARED_DATA_PATH === "undefined") return "";
        return cat + ".json";
    }

    function stringifyData(obj) {
        if (typeof JSON !== 'undefined' && JSON.stringify) return JSON.stringify(obj);
        return ""; 
    }

    function parseData(str) {
        if (!str) return null;
        try {
            if (typeof JSON !== 'undefined' && JSON.parse) return JSON.parse(str);
            return eval("(" + str + ")");
        } catch (e) { return null; }
    }

    async function saveFile(filename, text) {
        if (!window.globalDataDirHandle) return false;
        var maxRetries = 10;
        for (var i = 0; i < maxRetries; i++) {
            try {
                const fileHandle = await window.globalDataDirHandle.getFileHandle(filename, { create: true });
                const writable = await fileHandle.createWritable();
                await writable.write(text);
                await writable.close();
                return true;
            } catch (e) {
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }
        return false;
    }

    async function loadFile(filename) {
        if (!window.globalDataDirHandle) return null;
        try {
            const fileHandle = await window.globalDataDirHandle.getFileHandle(filename, { create: false });
            const file = await fileHandle.getFile();
            const text = await file.text();
            return text;
        } catch(e) {
            return null;
        }
    }

    

    var _lastTx = { op: "", id: "", val: "" };
    var _lastSavedDataHash = "";
    
    function getHash(obj) {
        var str = stringifyData(obj);
        var hash = 0;
        if (!str) return hash;
        for (var i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0;
        }
        return hash;
    }

    return {
        appData: {},

        init: function() {
            
        },

        loadAll: async function() {
            
            
            var adminList = ["16622", "17049", "17494", "17701", "17702"];
            adminList.push("3107", "17397", "17050", "16623", "17496", "3429", "17626");

            var disk = {
                patients: {}, wardNotes: {}, todos: [], history: [],
                settings: { adminIds: adminList, activeWardCodes: ["99"] },
                users: {}, announcement: "", admissionSchedule: [], dischargedArchive: {}
            };

            async function safeRead(cat) {
                var txt = await loadFile(getJsonPath(cat));
                return txt ? parseData(txt) : null;
            }

            var pat = (await safeRead("patients")) || {};
            if (pat.patients) disk.patients = pat.patients;
            if (pat.admissionSchedule) disk.admissionSchedule = pat.admissionSchedule;
            
            // ★修正: 過去のバグで配列として保存されている場合、辞書型(オブジェクト)に自動変換する
            if (pat.dischargedArchive) {
                if (pat.dischargedArchive instanceof Array) {
                    var arcObj = {};
                    for (var i = 0; i < pat.dischargedArchive.length; i++) {
                        if (pat.dischargedArchive[i] && pat.dischargedArchive[i].id) {
                            arcObj[pat.dischargedArchive[i].id] = pat.dischargedArchive[i];
                        }
                    }
                    disk.dischargedArchive = arcObj;
                } else {
                    disk.dischargedArchive = pat.dischargedArchive;
                }
            } else {
                disk.dischargedArchive = {};
            }

            disk.todos = (await safeRead("todos")) || [];
            var notes = (await safeRead("notes")) || {};
            disk.wardNotes = notes.wardNotes || notes || {};
            
            var settings = (await safeRead("settings")) || {};
            for (var key in settings) {
                disk.settings[key] = settings[key];
            }
            if (disk.settings.users) disk.users = disk.settings.users;
            if (settings.announcement !== undefined) disk.announcement = settings.announcement;

            disk.history = (await safeRead("history")) || [];
            disk.appliedTxIds = pat.appliedTxIds || []; 
            
            return disk;
        },

        
        getTxDirHandle: async function() {
            if (!window.globalDataDirHandle) return null;
            try {
                return await window.globalDataDirHandle.getDirectoryHandle("tx", { create: true });
            } catch(e) { return null; }
        },

        appendTransaction: async function(op, payload) {
            var txDir = await this.getTxDirHandle();
            if (!txDir) return false;

            var currentTxDataStr = stringifyData({ op: op, data: payload });
            if (this._lastTxDataStr === currentTxDataStr) return true;
            this._lastTxDataStr = currentTxDataStr;

            var ts = new Date().getTime();
            var txId = ts + "_" + (window.currentSystemId || "unknown") + "_" + Math.floor(Math.random() * 0x10000).toString(16);

            if (typeof appData !== 'undefined') {
                this._applyDelta(appData, op, payload, window.currentUserName);
                if (!appData.appliedTxIds) appData.appliedTxIds = [];
                appData.appliedTxIds.push(txId); 
            }

            var txData = { txId: txId, ts: ts, uId: window.currentSystemId, uName: window.currentUserName, op: op, data: payload };
            
            try {
                const fileHandle = await txDir.getFileHandle("tx_" + txId + ".json", { create: true });
                const writable = await fileHandle.createWritable();
                await writable.write(stringifyData(txData));
                await writable.close();
            } catch(e) {}

            this.hasLocalChanges = true;
            return true;
        },

        replayTransactions: async function(appData) {
            var txDir = await this.getTxDirHandle();
            if (!txDir || !appData) return false;

            var appliedMap = {};
            var appliedIds = appData.appliedTxIds || [];
            var maxAppliedTs = 0;
            for (var j = 0; j < appliedIds.length; j++) {
                appliedMap[appliedIds[j]] = true;
                var tsParts = appliedIds[j].split("_");
                var tsVal = parseInt(tsParts[0], 10);
                if (!isNaN(tsVal) && tsVal > maxAppliedTs) maxAppliedTs = tsVal;
            }

            if (lastReplayTs === 0 && maxAppliedTs > 60000) {
                lastReplayTs = maxAppliedTs - 60000;
            }

            var targets = [];
            for await (const entry of txDir.values()) {
                if (entry.kind === 'file' && entry.name.startsWith('tx_') && entry.name.endsWith('.json')) {
                    var parts = entry.name.split("_");
                    var ts = parseInt(parts[1], 10);
                    if (ts <= lastReplayTs) continue;

                    var txId = entry.name.replace("tx_", "").replace(".json", "");
                    if (!appliedMap[txId]) {
                        targets.push({ id: txId, ts: ts, handle: entry });
                    }
                }
            }

            if (targets.length === 0) return false;
            targets.sort(function(a, b) { return a.ts - b.ts; });

            var updatedCount = 0;
            if (!appData.appliedTxIds) appData.appliedTxIds = [];
            var maxTs = lastReplayTs;

            for (var i = 0; i < targets.length; i++) {
                try {
                    const file = await targets[i].handle.getFile();
                    const raw = await file.text();
                    var tx = parseData(raw);
                    if (tx) {
                        this._applyDelta(appData, tx.op, tx.data, tx.uName);
                        updatedCount++;
                    }
                    appData.appliedTxIds.push(targets[i].id);
                    if (targets[i].ts > maxTs) maxTs = targets[i].ts;
                } catch(e) {}
            }
            
            lastReplayTs = maxTs;
            if (appData.appliedTxIds.length > 500) {
                appData.appliedTxIds = appData.appliedTxIds.slice(-500);
            }
            return updatedCount > 0;
        },


        _applyDelta: function(appData, op, data, uName) {
            try {
                var p = null;
                if (data && data.patientId && data.wardCode) {
                    p = this._findPatientInAppData(appData, data.patientId, data.wardCode);
                }

                switch (op) {
                    case "UPDATE_ADMISSION_MEMO":
                        if (appData.admissionSchedule) {
                            for (var a = 0; a < appData.admissionSchedule.length; a++) {
                                if (String(appData.admissionSchedule[a].id) === String(data.patientId)) {
                                    appData.admissionSchedule[a].memo = data.value;
                                    this._updateMemoAuthors(appData.admissionSchedule[a], uName);
                                    break;
                                }
                            }
                        }
                        break;
                    case "UPDATE_SURGERY_INFO":
                        if (p) {
                            p.surgeryDate = data.surgeryDate;
                            p.surgeryDisease = data.surgeryDisease;
                            p.surgeryProcedure = data.surgeryProcedure;
                            p.surgeryAnesthesia = data.surgeryAnesthesia;
                            p.surgeryHasEpi = data.surgeryHasEpi;
                            p.surgeryLixiana = data.surgeryLixiana; // ★この1行を追加
                        }
                        break;
                    case "UPDATE_PATIENT_MEMO":
                        if (p) { p.memo = data.value; this._updateMemoAuthors(p, uName); }
                        else {
                            if (!appData.dischargedArchive || (appData.dischargedArchive instanceof Array)) {
                                appData.dischargedArchive = {};
                            }
                            if (!appData.dischargedArchive[data.patientId]) {
                                appData.dischargedArchive[data.patientId] = { id: data.patientId, archivedAt: new Date().getTime(), memoAuthors: [] };
                            }
                            var arc = appData.dischargedArchive[data.patientId];
                            arc.memo = data.value;
                            this._updateMemoAuthors(arc, uName);
                        }
                        break;
                    case "UPDATE_BLOOD_DATE":
                        if (p) {
                            p.bloodDate = data.bloodDate;
                            p.bloodDetail = data.bloodDetail;
                        }
                        break;
                    case "TOGGLE_STATUS":
                        // ★修正: 作業者名(author)も一緒に更新する
                        if (p) {
                            p.status = data.value;
                            p.statusAuthor = data.author || uName;
                        }
                        break;
                    case "TOGGLE_PRESCRIPTION":
                        if (p) p.chkPrescription = data.value;
                        break;
                    case "TOGGLE_ALERT":
                        if (p) p.alertLevel = data.value;
                        break;
                    case "UPDATE_PERSONAL_MEMO":
                        if (p) {
                            if (!p.personalMemos) p.personalMemos = {};
                            p.personalMemos[data.userId] = data.value;
                        }
                        break;
                    case "ADD_TODO":
                        if (!appData.todos) appData.todos = [];
                        var exists = false;
                        for (var k = 0; k < appData.todos.length; k++) {
                            if (String(appData.todos[k].id) === String(data.id)) {
                                exists = true;
                                for (var key in data) {
                                    if (data.hasOwnProperty(key)) appData.todos[k][key] = data[key];
                                }
                                break;
                            }
                        }
                        if (!exists) {
                            appData.todos.push(data);
                        }
                        break;
                    case "MARK_TODO_READ":
                        if (appData.todos) {
                            for (var k = 0; k < appData.todos.length; k++) {
                                if (String(appData.todos[k].id) === String(data.id)) {
                                    if (!appData.todos[k].readBy) appData.todos[k].readBy = [];
                                    if (appData.todos[k].readBy.indexOf(data.userId) === -1) {
                                        appData.todos[k].readBy.push(data.userId);
                                    }
                                    break;
                                }
                            }
                        }
                        break;
                    case "TOGGLE_TODO":
                        if (appData.todos) {
                            for(var k=0; k<appData.todos.length; k++) {
                                if (String(appData.todos[k].id) === String(data.id)) {
                                    appData.todos[k].done = data.done; break;
                                }
                            }
                        }
                        break;
                    case "DELETE_TODO":
                        if (appData.todos) {
                            for(var k=0; k<appData.todos.length; k++) {
                                if (String(appData.todos[k].id) === String(data.id)) {
                                    appData.todos[k].deleted = data.deleted; break;
                                }
                            }
                        }
                        break;
                    case "HARD_DELETE_TODO":
                        if (appData.todos) {
                            for(var k=0; k<appData.todos.length; k++) {
                                if (String(appData.todos[k].id) === String(data.id)) {
                                    appData.todos[k].hardDeleted = true; break;
                                }
                            }
                        }
                        break;
                    case "UPDATE_NOTE":
                        if (!appData.wardNotes) appData.wardNotes = {};
                        var wCode = data.wardCode || "99";
                        if (!appData.wardNotes[wCode]) appData.wardNotes[wCode] = [];
                        
                        var wardNotes = appData.wardNotes[wCode];
                        var foundNote = false;
                        for (var n = 0; n < wardNotes.length; n++) {
                            if (String(wardNotes[n].id) === String(data.id)) {
                                wardNotes[n].title = data.title;
                                wardNotes[n].content = data.content;
                                wardNotes[n].author = data.author || uName;
                                wardNotes[n].date = data.date;
                                foundNote = true;
                                break;
                            }
                        }
                        if (!foundNote) {
                            wardNotes.unshift({
                                id: data.id, title: data.title, content: data.content,
                                author: data.author || uName, date: data.date
                            });
                        }
                        break;
                    case "DELETE_NOTE":
                        if (appData.wardNotes) {
                            var wCode = data.wardCode || "99";
                            if (appData.wardNotes[wCode]) {
                                var wardNotes = appData.wardNotes[wCode];
                                for (var n = 0; n < wardNotes.length; n++) {
                                    if (String(wardNotes[n].id) === String(data.id)) {
                                        wardNotes.splice(n, 1);
                                        break;
                                    }
                                }
                            }
                        }
                        break;
                    case "UPDATE_CUSTOM_TABS":
                        if (!appData.settings) appData.settings = {};
                        if (!appData.settings.userCustomTabs) appData.settings.userCustomTabs = {};
                        appData.settings.userCustomTabs[data.userId] = data.tabs;
                        break;
                }
            } catch(e) {}
        },

        _updateMemoAuthors: function(p, uName) {
            var now = new Date();
            var minStr = (now.getMinutes() < 10 ? "0" : "") + now.getMinutes();
            var tsDisplay = (now.getMonth() + 1) + "/" + now.getDate() + " " + now.getHours() + ":" + minStr;
            var authorStr = uName + " (" + tsDisplay + ")";
            
            if (!p.memoAuthors) p.memoAuthors = [];
            if (p.memoAuthors[0] && p.memoAuthors[0].indexOf(uName) === 0) {
                p.memoAuthors[0] = authorStr;
            } else {
                p.memoAuthors.unshift(authorStr);
            }
            if (p.memoAuthors.length > 3) p.memoAuthors = p.memoAuthors.slice(0, 3);
            p.memoAuthor = p.memoAuthors[0];
        },

        _findPatientInAppData: function(appData, pid, wardCode) {
            var list = appData.patients ? appData.patients[wardCode] : null;
            if (list) {
                for (var i = 0; i < list.length; i++) {
                    if (String(list[i].id) === String(pid)) return list[i];
                }
            }
            if (appData.dischargedArchive && appData.dischargedArchive[pid]) {
                return appData.dischargedArchive[pid];
            }
            return null;
        },

        _lazyArchive: async function() {
            var now = new Date().getTime();
            if (now - lastArchiveTs < 600000) return; 
            
            var txDir = await this.getTxDirHandle();
            if (!txDir) return;
            var archiveDir;
            try {
                archiveDir = await txDir.getDirectoryHandle("archive", { create: true });
            } catch(e) { return; }
            
            var threshold = 3600000; 

            try {
                for await (const entry of txDir.values()) {
                    if (entry.kind === 'file' && entry.name.startsWith("tx_")) {
                        var parts = entry.name.split("_");
                        var fileTs = parseInt(parts[1], 10);
                        if (!isNaN(fileTs) && now - fileTs > threshold) {
                            // Move file using new API: read, write to archive, delete original
                            try {
                                const file = await entry.getFile();
                                const text = await file.text();
                                const arcHandle = await archiveDir.getFileHandle(entry.name, { create: true });
                                const writable = await arcHandle.createWritable();
                                await writable.write(text);
                                await writable.close();
                                await txDir.removeEntry(entry.name);
                            } catch(e) {}
                        }
                    }
                }
                lastArchiveTs = now;
            } catch(e) {}
        },

        _checkAndCreateBackup: async function(data) {
            try {
                if (!window.globalDataDirHandle) return;
                var now = new Date();
                var today = now.getFullYear() + ("0" + (now.getMonth() + 1)).slice(-2) + ("0" + now.getDate()).slice(-2);
                
                if (!data.settings) data.settings = {};
                if (data.settings.lastBackupDate === today) return;

                var backupDirRoot = await window.globalDataDirHandle.getDirectoryHandle("backup", { create: true });
                var targetDir = await backupDirRoot.getDirectoryHandle(today, { create: true });

                var files = ["patients.json", "settings.json", "todos.json", "notes.json", "history.json"];
                for (var i = 0; i < files.length; i++) {
                    try {
                        const srcHandle = await window.globalDataDirHandle.getFileHandle(files[i], { create: false });
                        const file = await srcHandle.getFile();
                        const text = await file.text();
                        
                        const destHandle = await targetDir.getFileHandle(files[i], { create: true });
                        const writable = await destHandle.createWritable();
                        await writable.write(text);
                        await writable.close();
                    } catch(e) {}
                }
                data.settings.lastBackupDate = today;
            } catch(e) {}
        },

        saveAll: async function(myData, forceSave) {
            
            
            // 1. 最新のディスク状態を読み込む
            var diskData = await this.loadAll(); 
            
            // 2. ★超重要: 読み込んだ後に、未適用のトランザクションを必ず自データ(myData)に適用する
            await this.replayTransactions(myData); 
            
            // 3. その上でマージする（最新のトランザクションが反映されたmyDataで上書き）
            var merged = await this._mergeAndSave(myData, diskData, forceSave);
            
            // ★追加: 保存のタイミングでバックアップを確認・実行
            this._checkAndCreateBackup(merged);
            
            this._lazyArchive(); 

            return merged; 
        },

        _mergeAndSave: async function(myData, diskData, forceSave) {
            var merged = {};

            merged.patients = myData.patients || {};
            merged.admissionSchedule = myData.admissionSchedule || [];
            merged.dischargedArchive = myData.dischargedArchive || {};
            merged.todos = myData.todos || [];

            // ★修正: 病棟メモ(wardNotes)をサーバーデータと安全にマージする
            merged.wardNotes = diskData.wardNotes || {}; 
            if (myData.wardNotes) {
                for (var wk in myData.wardNotes) {
                    if (myData.wardNotes.hasOwnProperty(wk)) {
                        // 自分の手元にデータがある病棟だけを最新化し、他は維持する
                        merged.wardNotes[wk] = myData.wardNotes[wk];
                    }
                }
            }

            var txIdMap = {};
            var mergedTxIds = [];
            var myTxIds = myData.appliedTxIds || [];
            var diskTxIds = diskData.appliedTxIds || [];

            for (var i = 0; i < myTxIds.length; i++) { 
                txIdMap[myTxIds[i]] = true; 
                mergedTxIds.push(myTxIds[i]); 
            }
            for (var j = 0; j < diskTxIds.length; j++) {
                if (!txIdMap[diskTxIds[j]]) { 
                    txIdMap[diskTxIds[j]] = true; 
                    mergedTxIds.push(diskTxIds[j]); 
                }
            }
            if (mergedTxIds.length > 500) mergedTxIds = mergedTxIds.slice(-500);
            merged.appliedTxIds = mergedTxIds;

            var myHist = (myData.history instanceof Array) ? myData.history : [];
            var dHist = (diskData.history instanceof Array) ? diskData.history : [];
            var histSeen = {};
            var histResult = [];
            var histCombo = myHist.concat(dHist);
            for (var hi = 0; hi < histCombo.length; hi++) {
                var hItem = histCombo[hi];
                if (!hItem) continue;
                var hKey = hItem.id ? String(hItem.id) : (hItem.createdAt ? String(hItem.createdAt) : null);
                if (hKey) {
                    if (!histSeen[hKey]) { histSeen[hKey] = true; histResult.push(hItem); }
                } else {
                    histResult.push(hItem); 
                }
            }
            merged.history = histResult;

            merged.settings = diskData.settings || {};
            if (myData.settings) {
                for (var sk in myData.settings) {
                    if (sk === "userWards") {
                        merged.settings.userWards = diskData.settings.userWards || {};
                        for (var uid in myData.settings.userWards) {
                            merged.settings.userWards[uid] = myData.settings.userWards[uid];
                        }
                    } else if (sk === "users") {
                        merged.settings.users = diskData.settings.users || {};
                        for (var uid in myData.settings.users) {
                            merged.settings.users[uid] = myData.settings.users[uid];
                        }
                    } else {
                        merged.settings[sk] = myData.settings[sk];
                    }
                }
            }
            merged.users = merged.settings.users || {};
            
            var bAnn = diskData.announcement || "";
            var mAnn = (myData.announcement !== undefined) ? myData.announcement : "";
            merged.announcement = (mAnn !== bAnn && mAnn !== "") ? mAnn : bAnn;
            merged.settings.announcement = merged.announcement;

            if (merged.settings.yrSettings) delete merged.settings.yrSettings;

            // ★最適化：ハッシュ値をチェックし、内容が同じならファイル書き込みをスキップ
            var currentHash = getHash(merged);
            if (!forceSave && currentHash === _lastSavedDataHash) {
                return merged; // 変更なし！何もしない（これが一番速い）
            }
            _lastSavedDataHash = currentHash;

            var patObj = { 
                patients: merged.patients, 
                admissionSchedule: merged.admissionSchedule, 
                dischargedArchive: merged.dischargedArchive,
                appliedTxIds: merged.appliedTxIds 
            };
            var patStr = stringifyData(patObj);
            if (patStr && patStr.length > 2) await saveFile(getJsonPath("patients"), patStr);

            var todoStr = stringifyData(merged.todos);
            if (todoStr && todoStr.length > 1) await saveFile(getJsonPath("todos"), todoStr);

            var notesStr = stringifyData({ wardNotes: merged.wardNotes });
            if (notesStr && notesStr.length > 2) await saveFile(getJsonPath("notes"), notesStr);

            var settingsStr = stringifyData(merged.settings);
            if (settingsStr && settingsStr.length > 2) await saveFile(getJsonPath("settings"), settingsStr);

            var histStr = stringifyData(merged.history);
            if (histStr && histStr.length > 1) await saveFile(getJsonPath("history"), histStr);

            return merged; 
        }
    };
})();