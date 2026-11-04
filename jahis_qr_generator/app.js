document.addEventListener('DOMContentLoaded', () => {
    // UI要素の取得
    const elements = {
        medTemplate: document.getElementById('medTemplate'),
        medicationsList: document.getElementById('medicationsList'),
        addMedBtn: document.getElementById('addMedBtn'),
        addCommentBtn: document.getElementById('addCommentBtn'),
        bulkParseBtn: document.getElementById('bulkParseBtn'),
        generateBtn: document.getElementById('generateBtn'),
        resultSection: document.getElementById('resultSection'),
        qrcodeContainer: document.getElementById('qrcodeContainer'),
        csvPreview: document.getElementById('csvPreview'),
        statsDisplay: document.getElementById('statsDisplay')
    };

    const today = new Date();
    const yyyymmdd = today.getFullYear() + String(today.getMonth() + 1).padStart(2, '0') + String(today.getDate()).padStart(2, '0');
    const yyyy_mm_dd = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    if (document.getElementById('dispenseDate')) {
        document.getElementById('dispenseDate').value = yyyy_mm_dd;
    }

    function toHalfWidth(str) {
        if (!str) return '';
        return str.replace(/[Ａ-Ｚａ-ｚ０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
    }

    function parseDateTo8Digits(str) {
        str = toHalfWidth(str).replace(/\s/g, '');
        if (!str) return '';
        
        const digits = str.replace(/[^0-9]/g, '');
        if (digits.length === 8 && /^(18|19|20)\d{6}$/.test(digits)) return digits;

        const eraMatch = str.match(/^(S|H|R|T|M|昭和|平成|令和|大正|明治|ｓ|ｈ|ｒ|ｔ|ｍ)(\d{1,2}|元)[年\/\.\-]?(\d{1,2})[月\/\.\-]?(\d{1,2})日?$/i);
        if (eraMatch) {
            const era = eraMatch[1].toUpperCase();
            let yearStr = eraMatch[2];
            let year = yearStr === '元' ? 1 : parseInt(yearStr, 10);
            let month = parseInt(eraMatch[3], 10);
            let day = parseInt(eraMatch[4], 10);
            
            let baseYear = 0;
            if (era === 'S' || era === '昭和' || era === 'Ｓ') baseYear = 1925;
            else if (era === 'H' || era === '平成' || era === 'Ｈ') baseYear = 1988;
            else if (era === 'R' || era === '令和' || era === 'Ｒ') baseYear = 2018;
            else if (era === 'T' || era === '大正' || era === 'Ｔ') baseYear = 1911;
            else if (era === 'M' || era === '明治' || era === 'Ｍ') baseYear = 1867;

            return `${baseYear + year}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}`;
        }

        const adMatch = str.match(/^(\d{2,4})[年\/\.\-]?(\d{1,2})[月\/\.\-]?(\d{1,2})日?$/);
        if (adMatch) {
            let year = parseInt(adMatch[1], 10);
            if (year < 100) year += (year < 30 ? 2000 : 1900);
            let month = parseInt(adMatch[2], 10);
            let day = parseInt(adMatch[3], 10);
            return `${year}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}`;
        }
        
        return digits.length === 8 ? digits : str; // フォールバック
    }

    const formatDob = () => {
        const input = document.getElementById('patientDob');
        const err = document.getElementById('dobError');
        if (!input) return;
        if (!input.value.trim()) { if(err) err.classList.remove('hidden'); return; }
        const parsed = parseDateTo8Digits(input.value);
        if (/^(18|19|20)\d{6}$/.test(parsed)) {
            input.value = parsed;
            if(err) err.classList.add('hidden');
        } else {
            if(err) err.classList.remove('hidden');
        }
    };
    if (document.getElementById('patientDob')) {
        document.getElementById('patientDob').addEventListener('blur', formatDob);
    }

    const convertHalfKanaToFull = (str) => {
        if (!str) return '';
        const kanaMap = {
            'ｶﾞ': 'ガ', 'ｷﾞ': 'ギ', 'ｸﾞ': 'グ', 'ｹﾞ': 'ゲ', 'ｺﾞ': 'ゴ',
            'ｻﾞ': 'ザ', 'ｼﾞ': 'ジ', 'ｽﾞ': 'ズ', 'ｾﾞ': 'ゼ', 'ｿﾞ': 'ゾ',
            'ﾀﾞ': 'ダ', 'ﾁﾞ': 'ヂ', 'ﾂﾞ': 'ヅ', 'ﾃﾞ': 'デ', 'ﾄﾞ': 'ド',
            'ﾊﾞ': 'バ', 'ﾋﾞ': 'ビ', 'ﾌﾞ': 'ブ', 'ﾍﾞ': 'ベ', 'ﾎﾞ': 'ボ',
            'ﾊﾟ': 'パ', 'ﾋﾟ': 'ピ', 'ﾌﾟ': 'プ', 'ﾍﾟ': 'ペ', 'ﾎﾟ': 'ポ',
            'ｳﾞ': 'ヴ', 'ｱ': 'ア', 'ｲ': 'イ', 'ｳ': 'ウ', 'ｴ': 'エ', 'ｵ': 'オ',
            'ｶ': 'カ', 'ｷ': 'キ', 'ｸ': 'ク', 'ｹ': 'ケ', 'ｺ': 'コ',
            'ｻ': 'サ', 'ｼ': 'シ', 'ｽ': 'ス', 'ｾ': 'セ', 'ｿ': 'ソ',
            'ﾀ': 'タ', 'ﾁ': 'チ', 'ﾂ': 'ツ', 'ﾃ': 'テ', 'ﾄ': 'ト',
            'ﾅ': 'ナ', 'ﾆ': 'ニ', 'ﾇ': 'ヌ', 'ﾈ': 'ネ', 'ﾉ': 'ノ',
            'ﾊ': 'ハ', 'ﾋ': 'ヒ', 'ﾌ': 'フ', 'ﾍ': 'ヘ', 'ﾎ': 'ホ',
            'ﾏ': 'マ', 'ﾐ': 'ミ', 'ﾑ': 'ム', 'ﾒ': 'メ', 'ﾓ': 'モ',
            'ﾔ': 'ヤ', 'ﾕ': 'ユ', 'ﾖ': 'ヨ', 'ﾗ': 'ラ', 'ﾘ': 'リ', 'ﾙ': 'ル', 'ﾚ': 'レ', 'ﾛ': 'ロ',
            'ﾜ': 'ワ', 'ｦ': 'ヲ', 'ﾝ': 'ン', 'ｧ': 'ァ', 'ｨ': 'ィ', 'ｩ': 'ゥ', 'ｪ': 'ェ', 'ｫ': 'ォ',
            'ｯ': 'ッ', 'ｬ': 'ャ', 'ｭ': 'ュ', 'ｮ': 'ョ', 'ｰ': 'ー', '･': '・'
        };
        let reg = new RegExp('(' + Object.keys(kanaMap).join('|') + ')', 'g');
        return str.replace(reg, match => kanaMap[match]);
    };

    const formatName = () => {
        const input = document.getElementById('patientName');
        const err = document.getElementById('nameError');
        if (!input || !input.value.trim()) { if(err) err.classList.add('hidden'); return; }
        let val = input.value.trim().replace(/ /g, '　'); // 半角スペースを全角に変換
        val = convertHalfKanaToFull(val); // 半角カナがあれば全角に変換
        input.value = val;
        if (val.includes('　')) {
            if(err) err.classList.add('hidden');
        } else {
            if(err) err.classList.remove('hidden');
        }
    };
    if (document.getElementById('patientName')) {
        document.getElementById('patientName').addEventListener('blur', formatName);
    }

    const formatKana = () => {
        const input = document.getElementById('patientKana');
        const err = document.getElementById('kanaError');
        if (!input || !input.value.trim()) { if(err) err.classList.add('hidden'); return; }
        let val = input.value.trim().replace(/ /g, '　'); // 半角スペースを全角に変換
        val = convertHalfKanaToFull(val); // 半角カナがあれば全角に変換
        input.value = val;
        if (val.includes('　')) {
            if(err) err.classList.add('hidden');
        } else {
            if(err) err.classList.remove('hidden');
        }
    };
    if (document.getElementById('patientKana')) {
        document.getElementById('patientKana').addEventListener('blur', formatKana);
    }

    // 薬品行の追加
    function addMedicationRow(name = '', dose = '', unit = '', code='', usage = '', memo = '') {
        try {
            const clone = elements.medTemplate.content.cloneNode(true);
            const rowDiv = clone.querySelector('.med-item');
            rowDiv.querySelector('.med-name').value = name;
            rowDiv.querySelector('.med-dose').value = dose;
            rowDiv.querySelector('.med-unit').value = unit;
            rowDiv.querySelector('.med-code').value = code;
            rowDiv.querySelector('.med-usage').value = usage;
            const memoEl = rowDiv.querySelector('.med-memo');
            if (memoEl) {
                memoEl.value = memo;
                memoEl.style.height = 'auto';
                requestAnimationFrame(() => {
                    if (memoEl.scrollHeight > 0) memoEl.style.height = memoEl.scrollHeight + 'px';
                });
                memoEl.addEventListener('input', function() {
                    this.style.height = 'auto';
                    this.style.height = (this.scrollHeight) + 'px';
                });
            }
            rowDiv.querySelector('.remove-med').addEventListener('click', function() {
                if (elements.medicationsList.querySelectorAll('.med-item').length > 1) rowDiv.remove();
            });
            elements.medicationsList.appendChild(clone);
        } catch (e) { console.error(e); }
    }

    // 初期状態は1行の空行を追加
    addMedicationRow();

    elements.addMedBtn.addEventListener('click', () => addMedicationRow());
    // コメント行追加: 薬剤名「コメント」、薬品コード種別「1」（コードなし）、単位「錠」、用法「申し送り 1日分」
    if (elements.addCommentBtn) {
        elements.addCommentBtn.addEventListener('click', () =>
            addMedicationRow('コメント', '1', '錠', '', '申し送り 1日分', '')
        );
    }

    const bulkInput = document.getElementById('bulkInput');
    if (bulkInput) {
        bulkInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = (this.scrollHeight + 2) + 'px';
        });
    }

    elements.bulkParseBtn.addEventListener('click', () => {
        const text = document.getElementById('bulkInput').value;
        if (!text.trim()) return;

        // 既存の空行リストを削除
        const existingItems = document.querySelectorAll('.med-item');
        existingItems.forEach(item => {
            const name = item.querySelector('.med-name').value.trim();
            const dose = item.querySelector('.med-dose').value.trim();
            const usage = item.querySelector('.med-usage').value.trim();
            if (!name && !dose && !usage) {
                item.remove();
            }
        });

        const lines = text.split(/\r\n|\r|\n/);
        const results = [];
        let currentGroup = [];

        for (let line of lines) {
            // 元のインデントを保持して空文字判定
            if (!line.replace(/^[ \t　]+|[ \t　]+$/g, '')) continue; 
            
            // 先頭のインデントの有無をチェック（コメント判定用）
            const hasIndent = /^[ \t　]+/.test(line);
            let trimmedLine = line.replace(/^[ \t　]+|[ \t　]+$/g, '');

            // グループの区切り・見出し行（ここでcurrentGroupをリセットして読み飛ばす）
            if (/^\[.+\]/.test(trimmedLine) || /^Rp\d+/i.test(trimmedLine)) {
                currentGroup = [];
                continue;
            }

            // 無視するパターンや不要な情報行
            if (/^院内\(.*?\)|^【契機外/.test(trimmedLine) || /樋口\s*佑輔|歯科口腔外科|薬情有|No\.\d+/.test(trimmedLine) || /^[0-9]{4}\/[0-9]{2}\/[0-9]{2}/.test(trimmedLine)) {
                continue;
            }

            // 先頭の処方番号を外す (例: "1    ロキソプロフェン" -> "ロキソプロフェン")
            let processLine = trimmedLine;
            const seqMatch = processLine.match(/^(\d+)[\s　]+(.+)$/);
            if (seqMatch && parseInt(seqMatch[1], 10) < 100) {
                const seqNum = parseInt(seqMatch[1], 10);
                if (seqNum === 1) {
                    // 番号が「1」の場合は新しいグループの先頭とみなす
                    currentGroup = [];
                }
                processLine = seqMatch[2];
            }

            // 余計な記号等を除去
            processLine = processLine.replace(/^★/, '').trim();

            // 薬品行の判定
            const medRegex = /^(.+?)[\s　]+([\d\.]+)[\s　]*([A-Za-zァ-ヶＴＣ本ｇ錠包枚滴ｍＬmL]+)?([\s　]+.*)?$/;
            let match = processLine.match(medRegex);
            
            if (match && !isNaN(parseFloat(match[2]))) {
                // 薬品行である可能性が高い
                let name = match[1].trim();
                let dose = match[2];
                let unit = (match[3] || "").trim();
                let remainder = (match[4] || "").trim();

                // remainder の先頭に "4/4" などの日付表記があれば削除
                const dateMatch = remainder.match(/^(\d+\/\d+)[\s　]*(.*)$/);
                if (dateMatch) {
                    remainder = dateMatch[2];
                }

                let med = {
                    name: name,
                    dose: dose,
                    unit: unit,
                    usage: remainder,
                    comment: ""
                };
                results.push(med);
                currentGroup.push(med); // 現在のグループに追加
            } else {
                // 薬品行ではない（用法やコメント行）
                if (currentGroup.length > 0) {
                    // グループ内のすべての薬剤に同じ用法/コメントを適用する
                    currentGroup.forEach(med => {
                        // もし usage が空か、インデントされておらず usageっぽいものなら
                        if (!med.usage && !hasIndent && /(分|日|回|時|後|前|間)/.test(trimmedLine)) {
                            med.usage = trimmedLine;
                        } else if (hasIndent) {
                            // インデントがある場合は「コメント」または「用法の下部」
                            if (!med.usage) {
                                med.usage = trimmedLine;
                            } else {
                                if (med.comment) med.comment += "\n";
                                med.comment += trimmedLine;
                            }
                        } else {
                            // インデントがない場合のコメント
                            if (med.comment) med.comment += "\n";
                            med.comment += trimmedLine;
                        }
                    });
                }
            }
        }

        // GUIへの反映
        if (results.length > 0) {
            results.forEach(med => {
                addMedicationRow(med.name, med.dose, med.unit, '', med.usage, med.comment);
            });
        } else {
            // パース失敗した時用に元のロジックフォールバック
            text.split(/\r\n|\r|\n/).forEach(l => {
                const tr = l.replace(/^[ \t　]+|[ \t　]+$/g, '');
                if(tr) addMedicationRow(tr);
            });
        }
        
        document.getElementById('bulkInput').value = ''; 
        const blkInput = document.getElementById('bulkInput');
        if (blkInput) blkInput.style.height = 'auto';
    });

    elements.generateBtn.addEventListener('click', (e) => {
        e.preventDefault();
        
        // 再チェック実行
        if(typeof formatDob === 'function') formatDob();
        if(typeof formatName === 'function') formatName();
        if(typeof formatKana === 'function') formatKana();
        
        let hasError = ['dobError', 'nameError', 'kanaError'].some(id => {
            const el = document.getElementById(id);
            return el && !el.classList.contains('hidden');
        });
        
        // 用量（数字のみ）のバリデーションチェック
        const medItems = document.querySelectorAll('.med-item');
        medItems.forEach(item => {
            const doseObj = item.querySelector('.med-dose');
            let doseStr = doseObj.value.trim();
            
            // 全角数字が含まれていれば半角に変換した値でチェックする
            doseStr = doseStr.replace(/[０-９．]/g, function(s) {
                return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
            });
            
            const name = item.querySelector('.med-name').value.trim();
            // 薬品名や用量が入力されている行のみチェック
            if (name || doseStr) {
                if (doseStr && !/^[\d\.]+$/.test(doseStr)) {
                    doseObj.classList.add('border-red-500', 'bg-red-100');
                    hasError = true;
                } else {
                    doseObj.classList.remove('border-red-500', 'bg-red-100');
                }
            }
        });
        
        if (hasError) {
            alert("入力データにエラーがあります。赤字のメッセージや、用量欄（数字・小数のみ可）の赤枠ハイライトを確認してください。");
            return; // 進行を中断
        }
        
        try { generateJAHISQR(); } catch (err) { alert("生成エラー: " + err.message + '\n' + err.stack); }
    });

    // global toHalfWidth is above

    function generateJAHISQR() {
        // カンマのみエスケープ（改行はメモ行分割に使用するため個別処理）
        const sanitize = (s) => s ? s.replace(/,/g, '，').trim() : '';
        // 改行とカンマ両方エスケープ（1行テキスト用）
        const sanitizeLine = (s) => s ? s.replace(/,/g, '，').replace(/\r\n|\r|\n/g, ' ').trim() : '';
        
        const pName = sanitizeLine(document.getElementById('patientName').value) || '未設定';
        const pKana = sanitizeLine(document.getElementById('patientKana').value) || '';
        const sexRadios = document.getElementsByName('patientSex');
        let pSex = '2'; for (let r of sexRadios) { if (r.checked) { pSex = r.value; break; } }
        const pDob = toHalfWidth(sanitizeLine(document.getElementById('patientDob').value)).replace(/[^0-9]/g, '');
        const dDate = toHalfWidth(sanitizeLine(document.getElementById('dispenseDate').value)).replace(/[^0-9]/g, '') || yyyymmdd;
        
        const hName = sanitizeLine(document.getElementById('hospitalName').value) || '焼津市立総合病院';
        const prefCode = toHalfWidth(sanitizeLine(document.getElementById('prefCode').value)) || '22';
        const tensuCode = document.getElementById('tensuCode').value || '1';
        const hCode = toHalfWidth(sanitizeLine(document.getElementById('hospitalCode').value)) || '5111204';
        const hZip = toHalfWidth(sanitizeLine(document.getElementById('hospitalZip').value)) || '4258505';
        const hAddr = sanitizeLine(document.getElementById('hospitalAddr').value) || '静岡県焼津市道原1000';
        const hTel = toHalfWidth(sanitizeLine(document.getElementById('hospitalTel').value)) || '054-623-3111';

        const prescHospitalName = sanitizeLine(document.getElementById('prescHospitalName').value);
        const prescHospitalCode = toHalfWidth(sanitizeLine(document.getElementById('prescHospitalCode').value));
        const doctorName = sanitizeLine(document.getElementById('doctorName').value);
        const deptName = sanitizeLine(document.getElementById('deptName').value);

        let lines = [`JAHISTC06,1`];
        lines.push(`1,${pName},${pSex},${pDob},,,,,,,${pKana}`);
        
        const pHist = document.getElementById('patientHistory').value;
        if (pHist) {
            pHist.split(/\r\n|\r|\n/).filter(l => l.trim()).forEach((l, i) => {
                const type = (i === 0) ? '1' : '2';
                lines.push(`2,${type},${sanitize(l)},1`);
            });
        }
        
        lines.push(`5,${dDate},1`);
        lines.push(`11,${hName},${prefCode},${tensuCode},${hCode},${hZip},${hAddr},${hTel},1`);
        
        if (prescHospitalName) lines.push(`51,${prescHospitalName},${prefCode},1,${prescHospitalCode},1`);
        if (doctorName) {
            lines.push(`55,${doctorName},${deptName || ''},1`);
        }

        const rpGroups = [];
        const medItems = document.querySelectorAll('.med-item');
        medItems.forEach((item, index) => {
            const mName = sanitizeLine(item.querySelector('.med-name').value);
            const mDose = toHalfWidth(sanitizeLine(item.querySelector('.med-dose').value));
            const mUnit = sanitizeLine(item.querySelector('.med-unit').value);
            const mCode = toHalfWidth(sanitizeLine(item.querySelector('.med-code').value));
            const mUsage = sanitizeLine(item.querySelector('.med-usage').value);
            
            // 改行コード(CR/LF両対応)で分割し、1行ずつ処理
            const memoRaw = item.querySelector('.med-memo').value;
            const memoLines = memoRaw ? memoRaw.split(/\r\n|\r|\n/).map(m => m.trim()).filter(m => m) : [];
            
            if (mName) {
                const lastGroup = rpGroups[rpGroups.length - 1];
                const hasMemo = memoLines.length > 0;
                const lastGroupHasMemo = lastGroup ? lastGroup.meds.some(m => m.memos && m.memos.length > 0) : false;
                
                // コメント（特記事項281等）が存在する場合は安全のためグループを分割し単独Rpとする
                if (lastGroup && lastGroup.rawUsage === mUsage && !hasMemo && !lastGroupHasMemo) {
                    lastGroup.meds.push({ name: mName, dose: mDose, unit: mUnit, code: mCode, memos: memoLines, originalIndex: index });
                } else {
                    rpGroups.push({ rawUsage: mUsage, meds: [{ name: mName, dose: mDose, unit: mUnit, code: mCode, memos: memoLines, originalIndex: index }] });
                }
            }
        });

        // CSVレコード生成
        rpGroups.forEach((group, rpIdx) => {
            const rpNo = rpIdx + 1;
            group.meds.forEach(med => {
                // codeType: YJコードあり→4, なし→1（JAHIS仕様: 空文字ではなく"1"を使用）
                const codeType = med.code ? '4' : '1';
                // 201: 薬品レコード (カンマは必ず7個 = 8項目)
                lines.push(`201,${rpNo},${med.name},${med.dose},${med.unit},${codeType},${med.code},1`);
                
                // メモを1行ずつ個別レコード化
                med.memos.forEach(memoLine => {
                    const cleanMemo = sanitize(memoLine);
                    const isFoodOrCaution = /飲食|注意/.test(cleanMemo);
                    const recordType = isFoodOrCaution ? '291' : '281';
                    lines.push(`${recordType},${rpNo},${cleanMemo},1`);
                });
            });

            if (group.rawUsage) {
                let q = "", u = "", name = group.rawUsage;
                const rx = /([0-9０-９\.]+)\s*(日分|回分|枚|包|本|個|錠|カプセル|T|調剤|式)[\s　]*$/i;
                const match = group.rawUsage.match(rx);
                if (match) { 
                    q = toHalfWidth(match[1]); 
                    u = match[2]; 
                    name = group.rawUsage.replace(rx, "").trim(); 
                }
                const isExternal = /枚|貼付|塗布|調剤|軟膏|クリーム|点眼|点耳|点鼻|スプレー|ローション|ゲル|液|外用/.test(group.rawUsage) || group.meds.some(m => /軟膏|クリーム|点眼|点耳|点鼻|スプレー|ローション|ゲル|液|外用/.test(m.name));
                const typeCode1 = isExternal ? '3' : '1'; 
                const typeCode2 = '1';
                
                // JAHIS読取エラー回避: 用法用量・単位が抽出できなかった場合、1調剤 / 1日分 を補完する
                if (!q) {
                    q = '1';
                    u = isExternal ? '調剤' : '日分';
                }

                // 301: 用法レコード (カンマは必ず8個 = 9項目)
                lines.push(`301,${rpNo},${name},${q},${u},${typeCode1},${typeCode2},,1`);
            }
        });

        // 全体コメント: 薬剤名「コメント」＋JAHISコードなし（種別=1）＋281にコメント本文
        // 201: codeType=1（コードなし）→ codeフィールドは省略、unit=「錠」（標準単位）
        // 301: unit=「日分」（最もポピュラーな用法単位）
        const globalMemoRaw = document.getElementById('globalMemo').value;
        if (globalMemoRaw.trim()) {
            const commentRpNo = rpGroups.length + 1;
            // codeType=1のとき、codeフィールドは省略（空文字）→ JAHIS仕様準拠
            lines.push(`201,${commentRpNo},コメント,1,錠,1,,1`);
            globalMemoRaw.split(/\r\n|\r|\n/)
                .map(l => sanitize(l))
                .filter(l => l)
                .forEach(memoLine => {
                    lines.push(`281,${commentRpNo},${memoLine},1`);
                });
            lines.push(`301,${commentRpNo},申し送り,1,日分,1,1,,1`);
        }

        const fullCsv = lines.join('\r\n') + '\r\n';
        elements.csvPreview.value = fullCsv;

        if (typeof Encoding === 'undefined') throw new Error("Encoding Library is missing.");
        const bytes = new Uint8Array(Encoding.convert(Encoding.stringToCode(fullCsv), { to: 'SJIS', from: 'UNICODE' }));
        
        // =======================================================================
        // ISO/IEC 18004 Structured Append 実装
        // パリティ = 全データバイトの単純XOR（回転なし）
        // =======================================================================
        let parity = 0;
        for (let b of bytes) {
            parity ^= b;  // 単純XOR（ISO/IEC 18004 準拠）
        }
        parity &= 0xFF;

        if (typeof qrcode === 'undefined') throw new Error("QR Library is missing.");

        // --- チャンク分割 ---
        // QRバージョン自動検出を使うため、typeNumber=0で試行する
        // まず1枚に収まるか試す
        // まず1枚に収まるか試す
        // カメラの読み取り精度と分割エラー防止のため MAX_SINGLE を600バイト程度に制限
        const MAX_SINGLE = 600; 
        
        let chunks = [];
        if (bytes.length <= MAX_SINGLE) {
            // 1枚に収まる場合: Structured Appendなし
            chunks = [bytes];
        } else {
            // 複数枚必要な場合: SJISの文字境界（マルチバイト）分断による文字化けを防ぐため、行単位で分割
            // さらに、特定のQRコードだけが極端に小さくなり読み取りエラー（バージョンパディング過多）になるのを防ぐため、均等分割を目指す
            const N = Math.ceil(bytes.length / MAX_SINGLE);
            const targetBytes = Math.ceil(bytes.length / N);
            
            let currentBytes = [];
            const getSJISBytes = (str) => Array.from(new Uint8Array(Encoding.convert(Encoding.stringToCode(str), { to: 'SJIS', from: 'UNICODE' })));
            
            for (let i = 0; i < lines.length; i++) {
                const lineStr = lines[i] + '\r\n';
                const lineBytes = getSJISBytes(lineStr);
                
                // 次の行を加えると絶対上限(MAX_SINGLE)を超える、または、現在までに「目標バイト数」に達しており、最後のチャンクでない場合は分割
                if (currentBytes.length > 0 && ((currentBytes.length + lineBytes.length > MAX_SINGLE) || (chunks.length < N - 1 && currentBytes.length >= targetBytes))) {
                    chunks.push(new Uint8Array(currentBytes));
                    currentBytes = lineBytes;
                } else {
                    currentBytes = currentBytes.concat(lineBytes);
                }
            }
            if (currentBytes.length > 0) {
                chunks.push(new Uint8Array(currentBytes));
            }
        }

        const total = chunks.length;
        
        // --- 統一バージョン計算 ---
        // 全チャンクで同じバージョンを使う必要がある（Structured Appendの要件）
        let ver = 0; // 0 = 自動
        if (total > 1) {
            // 最大チャンクのバージョンを求める（全チャンク共通で使用）
            let maxVer = 1;
            for (let i = 0; i < total; i++) {
                const chunk = chunks[i];
                const testQr = qrcode(0, 'L');
                testQr.setStructuredAppend(total, i, parity);
                const bin = Array.from(chunk).map(b => String.fromCharCode(b)).join('');
                testQr.addData(bin, 'Byte');
                testQr.make();
                // getTypeNumber は標準APIにないため、モジュール数から逆算
                const mods = testQr.getModuleCount();
                const detectedVer = (mods - 17) / 4;
                if (detectedVer > maxVer) maxVer = detectedVer;
            }
            ver = maxVer;
        }

        // --- 描画 ---
        // 統計情報を表示
        if (elements.statsDisplay) {
            const sizeStr = bytes.length.toLocaleString();
            const multiLabel = total > 1 ? ` <span class="text-orange-600 font-bold">（連結QR・1枚目から順にスキャン）</span>` : ' <span class="text-green-600">（1枚で完結）</span>';
            elements.statsDisplay.innerHTML =
                `<span>📋 データサイズ: <strong>${sizeStr} バイト</strong></span>` +
                `<span class="mx-3 text-gray-300">|</span>` +
                `<span>📱 QRコード: <strong>${total} 枚</strong>${multiLabel}</span>`;
        }

        elements.qrcodeContainer.innerHTML = '';
        for (let i = 0; i < total; i++) {
            renderQR(elements.qrcodeContainer, i, total, chunks[i], parity, ver);
        }
        elements.resultSection.classList.remove('hidden');
        elements.resultSection.scrollIntoView({ behavior: 'smooth' });

        // Hidden解除後に高さを計算する
        elements.csvPreview.style.height = 'auto';
        elements.csvPreview.style.height = (elements.csvPreview.scrollHeight + 2) + 'px';

        // お薬手帳風プレビューの構築
        if (typeof buildRichPreview === 'function') {
            buildRichPreview(rpGroups);
        }
    }

    function renderQR(container, idx, total, chunk, parity, ver) {
        const wrap = document.createElement('div');
        wrap.className = 'flex flex-col items-center bg-white p-3 border border-gray-200 rounded shadow-sm flex-shrink-0';

        // ラベル（複数枚時はバッジ付き）
        const title = document.createElement('div');
        title.className = 'text-xs font-bold mb-2 text-center';
        if (total > 1) {
            title.innerHTML = `<span class="inline-block bg-orange-500 text-white rounded-full px-2 py-0.5 text-xs font-bold mr-1">${idx + 1}/${total}</span>連結QR`;
        } else {
            title.textContent = 'お薬手帳QR';
        }
        const canvas = document.createElement('canvas');
        wrap.appendChild(title);
        wrap.appendChild(canvas);
        container.appendChild(wrap);

        const qr = qrcode(ver > 0 ? ver : 0, 'L');
        if (total > 1) {
            qr.setStructuredAppend(total, idx, parity);
        }
        const bin = Array.from(chunk).map(b => String.fromCharCode(b)).join('');
        qr.addData(bin, 'Byte');
        qr.make();

        const mods = qr.getModuleCount();
        const margin = 4;
        // アダプティブセルサイズ: 最大270pxに収まるよう調整（最小2px・最大4px）
        const cell = Math.min(4, Math.max(2, Math.floor(270 / (mods + margin * 2))));
        canvas.width = canvas.height = (mods + margin * 2) * cell;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#000';
        for (let r = 0; r < mods; r++) {
            for (let c = 0; c < mods; c++) {
                if (qr.isDark(r, c)) ctx.fillRect((c + margin) * cell, (r + margin) * cell, cell, cell);
            }
        }
    }

    // --- リッチプレビュー関連の処理 ---
    function buildRichPreview(rpGroups) {
        const content = document.getElementById('richPreviewContent');
        if (!content) return;

        const patientName = document.getElementById('patientName').value.trim() || '未設定';
        const patientDob = document.getElementById('patientDob').value.trim() || '';
        const patientGender = document.querySelector('input[name="patientSex"]:checked').value;
        const dispenseDate = document.getElementById('dispenseDate').value;
        const prescHospitalName = document.getElementById('prescHospitalName').value.trim();

        let genderStr = patientGender === "1" ? "男" : patientGender === "2" ? "女" : "不明";

        let html = `
            <div class="bg-white p-3 rounded border border-gray-200 mb-3 shadow-sm">
                <div class="flex flex-wrap gap-x-6 gap-y-2 items-center mb-2 border-b border-gray-100 pb-2">
                    <div>
                        <span class="text-xs text-gray-500">氏名:</span> 
                        <input type="text" class="preview-input font-bold text-base w-32" data-target="patientName" value="${patientName}"> 様
                        <span class="text-xs text-gray-500 ml-1">(${genderStr})</span>
                    </div>
                    <div>
                        <span class="text-xs text-gray-500">生年月日:</span> 
                        <input type="text" class="preview-input w-24" data-target="patientDob" value="${patientDob}">
                    </div>
                    <div>
                        <span class="text-xs text-gray-500">調剤日:</span> 
                        <input type="text" class="preview-input w-24" data-target="dispenseDate" value="${dispenseDate}">
                    </div>
                </div>
                <div class="text-sm text-gray-700">
                    <span class="text-xs text-gray-500">処方元:</span> 
                    <input type="text" class="preview-input font-bold w-48" data-target="prescHospitalName" value="${prescHospitalName}">
                </div>
            </div>
        `;

        if (rpGroups.length === 0) {
            html += `<div class="text-center text-gray-500 py-4">処方データがありません</div>`;
        }

        rpGroups.forEach((rp, idx) => {
            html += `<div class="bg-white border border-gray-200 rounded p-3 mb-3 shadow-sm">`;
            html += `<div class="font-bold text-blue-700 text-sm border-b border-gray-200 pb-1 mb-2">Rp.${idx + 1}</div>`;
            
            rp.meds.forEach(med => {
                html += `
                    <div class="flex flex-wrap items-center gap-1 mb-1 pl-2">
                        <span class="text-sm">💊</span>
                        <input type="text" class="preview-input font-bold text-sm flex-grow min-w-[200px]" data-med-index="${med.originalIndex}" data-med-field="name" value="${med.name}">
                        <input type="text" class="preview-input text-sm w-12 text-right" data-med-index="${med.originalIndex}" data-med-field="dose" value="${med.dose}">
                        <input type="text" class="preview-input text-sm w-12" data-med-index="${med.originalIndex}" data-med-field="unit" value="${med.unit}">
                    </div>
                `;
                if (med.memos && med.memos.length > 0) {
                    html += `
                    <div class="pl-8 mb-2">
                        <textarea class="preview-area text-xs text-gray-600" data-med-index="${med.originalIndex}" data-med-field="memo" rows="${med.memos.length}">${med.memos.join('\n')}</textarea>
                    </div>
                    `;
                }
            });
            
            if (rp.rawUsage) {
                // 同じRpグループの全ての薬剤の用法を一括更新するためのインデックスリスト
                const medIndices = rp.meds.map(m => m.originalIndex).join(',');
                html += `
                    <div class="pl-2 mt-2 text-green-700 font-bold text-sm flex items-start gap-1">
                        <span class="mt-1">📝</span>
                        <textarea class="preview-area w-full font-bold" data-rp-indices="${medIndices}" rows="1">${rp.rawUsage}</textarea>
                    </div>
                `;
            }
            html += `</div>`;
        });

        // 処方全体のコメント（申し送り事項）ブロック
        const globalMemo = document.getElementById('globalMemo').value;
        html += `
            <div class="bg-gray-100 border border-gray-300 rounded p-3 mb-3 shadow-sm mt-4">
                <div class="font-bold text-gray-700 text-sm mb-2 flex items-center gap-1">
                    <span>📋</span> 処方全体へのコメント（申し送り事項）
                </div>
                <textarea class="preview-area w-full text-sm text-gray-800 bg-white" data-target="globalMemo" rows="${globalMemo ? Math.max(2, globalMemo.split('\\n').length) : 2}" placeholder="ここに全体コメントを入力して追加できます...">${globalMemo}</textarea>
            </div>
        `;

        content.innerHTML = html;
        const updateArea = document.getElementById('previewUpdateArea');
        if (updateArea) updateArea.classList.add('hidden');

        // イベントリスナー: 何か編集されたら更新ボタンを表示する
        const inputs = content.querySelectorAll('input, textarea');
        inputs.forEach(input => {
            input.addEventListener('input', () => {
                if (updateArea) updateArea.classList.remove('hidden');
            });
            // Textareaの自動リサイズ
            if (input.tagName.toLowerCase() === 'textarea') {
                input.addEventListener('input', function() {
                    this.style.height = 'auto';
                    this.style.height = (this.scrollHeight + 2) + 'px';
                });
            }
        });
    }

    // プレビューからの更新ボタンのイベント登録
    const updateBtn = document.getElementById('updateFromPreviewBtn');
    if (updateBtn) {
        updateBtn.addEventListener('click', () => {
            const content = document.getElementById('richPreviewContent');
            
            // 1. 患者・病院情報・全体コメントの反映
            const simpleTargets = ['patientName', 'patientDob', 'dispenseDate', 'prescHospitalName', 'globalMemo'];
            simpleTargets.forEach(id => {
                const input = content.querySelector(`[data-target="${id}"]`);
                if (input && document.getElementById(id)) {
                    document.getElementById(id).value = input.value;
                }
            });

            // 2. 薬品情報（名前・用量・単位・メモ）の反映
            const medItems = document.querySelectorAll('.med-item');
            const medInputs = content.querySelectorAll('[data-med-index]');
            medInputs.forEach(input => {
                const idx = parseInt(input.getAttribute('data-med-index'), 10);
                const field = input.getAttribute('data-med-field');
                if (medItems[idx]) {
                    if (field === 'name') medItems[idx].querySelector('.med-name').value = input.value;
                    if (field === 'dose') medItems[idx].querySelector('.med-dose').value = input.value;
                    if (field === 'unit') medItems[idx].querySelector('.med-unit').value = input.value;
                    if (field === 'memo') medItems[idx].querySelector('.med-memo').value = input.value;
                }
            });

            // 3. 用法 (Rpごと)の反映
            const usageInputs = content.querySelectorAll('[data-rp-indices]');
            usageInputs.forEach(input => {
                const indices = input.getAttribute('data-rp-indices').split(',');
                const val = input.value;
                indices.forEach(idxStr => {
                    if (!idxStr) return;
                    const idx = parseInt(idxStr, 10);
                    if (medItems[idx]) {
                        medItems[idx].querySelector('.med-usage').value = val;
                    }
                });
            });

            // QR再生成関数をコール
            if (typeof generateJAHISQR === 'function') {
                generateJAHISQR();
            }
            
            // スクロールをQRコードが見える位置へ移動
            document.getElementById('resultSection').scrollIntoView({ behavior: 'smooth' });
        });
    }
});