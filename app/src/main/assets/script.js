/**
 * Goldltm - WebView Application Script
 * Moniepoint-inspired demo banking app.
 * All balances and transactions are simulated.
 */

'use strict';

// ============================================
// Utility helpers
// ============================================

const Utils = {
    hasAndroid: typeof Android !== 'undefined',

    naira(amount) {
        const n = Number(amount) || 0;
        return '₦' + n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },

    nairaPlain(amount) {
        const n = Number(amount) || 0;
        return 'NGN' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },

    formatDateTime(iso) {
        const d = new Date(iso);
        if (isNaN(d.getTime())) return '---';
        return d.toLocaleDateString('en-NG', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
               ' ' + d.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    },

    formatDate(iso) {
        const d = new Date(iso);
        if (isNaN(d.getTime())) return '---';
        return d.toLocaleDateString('en-NG', { day: '2-digit', month: '2-digit', year: 'numeric' });
    },

    formatTime(iso) {
        const d = new Date(iso);
        if (isNaN(d.getTime())) return '---';
        return d.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    },

    timeAgo(iso) {
        const d = new Date(iso);
        if (isNaN(d.getTime())) return '';
        const diff = Math.floor((Date.now() - d.getTime()) / 1000);
        if (diff < 60) return 'Just now';
        if (diff < 3600) return Math.floor(diff / 60) + ' min ago';
        if (diff < 86400) return Math.floor(diff / 3600) + ' hr ago';
        return d.toLocaleDateString('en-NG', { month: 'short', day: 'numeric' });
    },

    esc(text) {
        const div = document.createElement('div');
        div.textContent = String(text == null ? '' : text);
        return div.innerHTML;
    },

    initial(name) {
        const n = (name || 'U').trim();
        return (n.charAt(0) || 'U').toUpperCase();
    },

    // Derive +234 phone from a Goldltm account number: 0198123456789 -> +2348123456789
    phoneFromAccount(accountNumber) {
        return Utils.toInternationalPhone(String(accountNumber || '').replace(/^019/, ''));
    },

    // Normalize any local/international Nigerian number to +234XXXXXXXXXX
    toInternationalPhone(phone) {
        let s = String(phone || '').replace(/\D/g, '');
        if (s.indexOf('234') === 0) return '+234' + s.slice(3).replace(/^0/, '');
        if (s.indexOf('0') === 0) s = s.slice(1);
        return '+234' + s;
    },

    // Mobile banks (OPay, PalmPay, Kuda, Moniepoint, ...) issue accounts that ARE
    // the customer's phone number, so credit-alert SMS can reach them.
    isMobileBank(name) {
        return /(paycom|opay|palm\s*pay|kuda|moniepoint|spark|eyowo|paga)/i.test(String(name || ''));
    }
};

// ============================================
// Native bridge (Kotlin <-> JS)
// ============================================

const Api = {
    _counter: 0,
    _handlers: {},

    // Called from Kotlin via evaluateJavascript
    dispatch(callbackId, channel, dataStr) {
        const handler = this._handlers[callbackId];
        delete this._handlers[callbackId];
        if (!handler) return;
        let data = dataStr;
        try { data = JSON.parse(dataStr); } catch (e) { /* keep raw */ }
        try { handler(channel, data); } catch (e) { console.error('Api handler error', e); }
    },

    call(method, params, callback) {
        if (!Utils.hasAndroid) {
            console.warn('Android bridge unavailable, method:', method);
            if (callback) callback('bridge_error', { error: 'bridge unavailable' });
            return null;
        }
        const cbId = ++this._counter;
        if (callback) this._handlers[cbId] = callback;
        const args = (params || []).slice();
        args.push(cbId);
        try {
            switch (method) {
                case 'getJsonBin': Android.getJsonBin(args[0], cbId); break;
                case 'updateJsonBin': Android.updateJsonBin(args[0], args[1], cbId); break;
                case 'fetchBankName': Android.fetchBankName(args[0], args[1], args[2], cbId); break;
                case 'getBankList': Android.getBankList(cbId); break;
                case 'shareReceiptImage': Android.shareReceiptImage(args[0], cbId); break;
                case 'saveReceiptImage': Android.saveReceiptImage(args[0], cbId); break;
                case 'sendCreditSms': Android.sendCreditSms(args[0], args[1], cbId); break;
                case 'launchCamera': Android.launchCamera(cbId); break;
                case 'launchGallery': Android.launchGallery(cbId); break;
                default: console.error('Unknown Api method:', method);
            }
        } catch (e) {
            console.error('Api call failed', method, e);
            if (callback) callback('bridge_error', { error: String(e) });
        }
        return cbId;
    },

    sync(method, params) {
        if (!Utils.hasAndroid) return null;
        const args = params || [];
        try {
            switch (method) {
                case 'hashPin': return Android.hashPin(args[0]);
                case 'verifyPinHash': return Android.verifyPinHash(args[0], args[1]);
                case 'generateWalletAddress': return Android.generateWalletAddress();
                case 'generateAccountNumber': return Android.generateAccountNumber(args[0]);
                case 'generateTransactionId': return Android.generateTransactionId();
                case 'generateReference': return Android.generateReference();
                case 'generateReceiptNo': return Android.generateReceiptNo();
                case 'getAppVersion': return Android.getAppVersion();
                case 'getSenderId': return Android.getSenderId();
                case 'getBinId': return Android.getBinId();
                case 'getTermiiBase': return Android.getTermiiBase();
                case 'getDeviceInfo': return Android.getDeviceInfo();
                case 'isBiometricAvailable': return Android.isBiometricAvailable();
                case 'isBiometricLoginEnabled': return Android.isBiometricLoginEnabled();
                case 'isBiometricTransferEnabled': return Android.isBiometricTransferEnabled();
                case 'enableBiometricTransfer': return Android.enableBiometricTransfer();
                case 'disableBiometricTransfer': return Android.disableBiometricTransfer();
                case 'savePreference': Android.savePreference(args[0], args[1]); return true;
                case 'getPreference': return Android.getPreference(args[0]);
                case 'clearPreference': Android.clearPreference(args[0]); return true;
                case 'clearAllPreferences': Android.clearAllPreferences(); return true;
                case 'shareText': Android.shareText(args[0]); return true;
                case 'showToast': Android.showToast(args[0], args[1] === true); return true;
                default: console.error('Unknown sync method:', method); return null;
            }
        } catch (e) {
            console.error('Api.sync failed', method, e);
            return null;
        }
    }
};
window.__goldDispatch = function (callbackId, channel, data) {
    Api.dispatch(callbackId, channel, data);
};

// ============================================
// Session (SharedPreferences-backed)
// ============================================

const Session = {
    get(key, fallback) {
        const v = Api.sync('getPreference', [key]);
        return (v === null || v === undefined || v === '') ? (fallback || '') : v;
    },
    set(key, value) {
        Api.sync('savePreference', [key, String(value)]);
    },
    remove(key) {
        Api.sync('clearPreference', [key]);
    },

    get phoneNumber() { return this.get('phone_number'); },
    get accountNumber() { return this.get('account_number'); },
    get username() { return this.get('username'); },
    get email() { return this.get('user_email'); },
    get bvn() { return this.get('user_bvn'); },
    get walletAddress() { return this.get('wallet_address'); },
    get pinHash() { return this.get('pin_hash'); },
    get avatarUrl() { return this.get('avatar_url'); },
    get isLoggedIn() { return this.get('is_logged_in') === 'true'; },

    saveUser(user) {
        this.set('phone_number', user.phoneNumber || '');
        this.set('account_number', user.accountNumber || '');
        this.set('username', user.fullName || '');
        this.set('user_email', user.email || '');
        this.set('user_bvn', user.bvn || '');
        this.set('wallet_address', user.walletAddress || '');
        this.set('avatar_url', user.avatarUrl || '');
    },

    setLoggedIn(value) {
        this.set('is_logged_in', value ? 'true' : 'false');
    },

    clear() {
        this.set('is_logged_in', 'false');
    }
};

// ============================================
// Toast notifications
// ============================================

const Toast = {
    show(message, type) {
        const old = document.querySelector('.toast');
        if (old) old.remove();
        const toast = document.createElement('div');
        toast.className = 'toast ' + (type === 'error' ? 'error' : 'success');
        const icon = type === 'error'
            ? '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>'
            : '<path d="M20 6L9 17l-5-5"/>';
        toast.innerHTML =
            '<svg class="toast-icon ' + (type === 'error' ? 'error' : 'success') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' + icon + '</svg>' +
            '<span class="toast-message">' + Utils.esc(message) + '</span>';
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(20px)';
            setTimeout(() => toast.remove(), 250);
        }, 3000);
    }
};

// ============================================
// PIN entry overlay (4-digit numpad)
// ============================================

const PinEntry = {
    _cb: null,
    _pin: '',
    _verifying: false,

    init() {
        const numpad = document.getElementById('pin-numpad');
        if (!numpad) return;
        const keys = ['1','2','3','4','5','6','7','8','9','clear','0','del'];
        numpad.innerHTML = keys.map(k => {
            if (k === 'del') return '<button class="pin-btn back" data-key="del">⌫</button>';
            if (k === 'clear') return '<button class="pin-btn back" data-key="clear" style="font-size:12px">CLR</button>';
            return '<button class="pin-btn" data-key="' + k + '">' + k + '</button>';
        }).join('');
        numpad.querySelectorAll('.pin-btn').forEach(btn => {
            btn.addEventListener('click', () => this._press(btn.dataset.key));
        });
    },

    // request(title, callback(pin))
    request(title, callback) {
        this._cb = callback;
        this._pin = '';
        this._verifying = false;
        document.getElementById('pin-title').textContent = title || 'Enter PIN';
        document.getElementById('pin-error').textContent = '';
        this._render();
        Navigation.show('pin-entry', true);
    },

    _press(key) {
        if (this._verifying) return;
        if (key === 'clear') this._pin = '';
        else if (key === 'del') this._pin = this._pin.slice(0, -1);
        else if (this._pin.length < 4) this._pin += key;
        this._render();
        if (this._pin.length === 4) {
            const cb = this._cb;
            this._verifying = true;
            setTimeout(() => {
                Navigation.goBack();
                if (cb) cb(this._pin);
            }, 150);
        }
    },

    _render() {
        const dots = document.querySelectorAll('#pin-dots .dot');
        dots.forEach((dot, i) => {
            dot.classList.toggle('filled', i < this._pin.length);
        });
    },

    cancel() {
        this._cb = null;
        this._pin = '';
        Navigation.goBack();
    },

    error(message) {
        document.getElementById('pin-error').textContent = message || 'Incorrect PIN';
    }
};

// ============================================
// Navigation
// ============================================

const Navigation = {
    _stack: [],
    current: 'splash',

    show(screenName, replace) {
        if (!replace && this.current && this.current !== screenName) {
            this._stack.push(this.current);
        }
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        const el = document.getElementById(screenName + '-screen');
        if (el) el.classList.add('active');
        this.current = screenName;
        if (screenName === 'main-app') Dashboard.load();
        if (screenName === 'transactions') Transactions.load();
        if (screenName === 'cards') Cards.load();
        if (screenName === 'profile') Profile.load();
    },

    goBack() {
        const prev = this._stack.pop() || 'main-app';
        this.show(prev, true);
    }
};

const BottomNav = {
    go(tab) {
        const screens = { home: 'main-app', transactions: 'transactions', cards: 'cards', profile: 'profile' };
        const target = screens[tab] || 'main-app';
        Navigation.show(target);
        document.querySelectorAll('.nav-item').forEach(item => {
            const active = item.dataset.tab === tab;
            item.classList.toggle('active', active);
            item.classList.toggle('inactive', !active);
        });
    }
};

// ============================================
// JSON Bin store
// ============================================

const Store = {
    binData: null,

    binId() {
        return Api.sync('getBinId', []) || '6ac9ed15ffd5d160535e59a3';
    },

    // Migrate legacy bin shapes into the canonical app schema:
    // - `users` as an array -> object keyed by account number
    // - fullname/phone/transactionPin -> fullName/phoneNumber/pin
    // - transactions with date/received/sent -> timestamp/credit/debit
    // Preserves every other top-level key (wallets, lastSync, version, meta).
    normalize(data) {
        if (!data || typeof data !== 'object') return;
        const map = {};
        const users = data.users;
        if (Array.isArray(users)) {
            users.forEach((u, i) => {
                if (!u || typeof u !== 'object') return;
                map[u.accountNumber || u.phone || u.id || ('user_' + i)] = u;
            });
        } else if (users && typeof users === 'object') {
            Object.keys(users).forEach(k => {
                if (users[k] && typeof users[k] === 'object') map[k] = users[k];
            });
        }
        Object.keys(map).forEach(key => {
            const u = map[key];
            if (!u.fullName && u.fullname) u.fullName = String(u.fullname).trim();
            if (!u.phoneNumber && u.phone) u.phoneNumber = String(u.phone).trim();
            if (!u.pin && u.transactionPin) u.pin = String(u.transactionPin);
            if (!Array.isArray(u.transactions)) u.transactions = [];
            u.transactions.forEach(t => {
                if (!t || typeof t !== 'object') return;
                if (!t.timestamp && t.date) t.timestamp = t.date;
                if (t.type === 'received' || t.type === 'credit_in') t.type = 'credit';
                else if (t.type === 'sent' || t.type === 'debit_out') t.type = 'debit';
                if (!t.status) t.status = 'successful';
            });
            if (!Array.isArray(u.beneficiaries)) u.beneficiaries = [];
            if (!Array.isArray(u.cards)) u.cards = [];
            if (typeof u.balance !== 'number') u.balance = Number(u.balance) || 0;
        });
        data.users = map;
    },

    load() {
        return new Promise((resolve, reject) => {
            Api.call('getJsonBin', [this.binId()], (channel, data) => {
                if (channel === 'jsonbin_data') {
                    try {
                        // data may already be parsed object from Api.dispatch
                        let parsed = typeof data === 'string' ? JSON.parse(data) : data;
                        // JSON Bin wraps responses as { record, metadata } unless X-Bin-Meta: false
                        if (parsed && parsed.record && typeof parsed.record === 'object' && !parsed.users) {
                            parsed = parsed.record;
                        }
                        this.binData = (parsed && typeof parsed === 'object') ? parsed : {};
                        this.normalize(this.binData);
                        if (!this.binData.users) this.binData.users = {};
                        if (!this.binData.meta) this.binData.meta = {};
                        resolve(this.binData);
                    } catch (e) {
                        reject(new Error('Corrupt bin data'));
                    }
                } else if (channel === 'jsonbin_error') {
                    reject(new Error((data && data.error) || 'Failed to load bin'));
                } else {
                    reject(new Error('Unexpected response'));
                }
            });
        });
    },

    save() {
        return new Promise((resolve, reject) => {
            if (!this.binData) return reject(new Error('No data to save'));
            this.binData.meta = this.binData.meta || {};
            this.binData.meta.lastUpdated = new Date().toISOString();
            this.binData.meta.totalUsers = Object.keys(this.binData.users || {}).length;
            this.binData.meta.appVersion = Api.sync('getAppVersion', []) || '1.0.0';
            Api.call('updateJsonBin', [this.binId(), JSON.stringify(this.binData)], (channel, data) => {
                if (channel === 'jsonbin_update') resolve(data);
                else reject(new Error((data && data.error) || 'Failed to save bin'));
            });
        });
    },

    userByPhone(phone) {
        const users = (this.binData && this.binData.users) || {};
        for (const key in users) {
            if (users[key].phoneNumber === phone) return users[key];
        }
        return null;
    },

    userByAccount(accountNumber) {
        const users = (this.binData && this.binData.users) || {};
        return users[accountNumber] || null;
    },

    userByWallet(walletAddress) {
        const users = (this.binData && this.binData.users) || {};
        for (const key in users) {
            if (users[key].walletAddress === walletAddress) return users[key];
        }
        return null;
    },

    currentUser() {
        if (!Session.accountNumber) return null;
        return this.userByAccount(Session.accountNumber);
    },

    balanceOf(user) {
        return (user && Number(user.balance)) || 0;
    },

    addTransaction(user, txn) {
        if (!user.transactions) user.transactions = [];
        user.transactions.unshift(txn);
        if (user.transactions.length > 200) user.transactions.length = 200;
    },

    addBeneficiary(user, beneficiary) {
        if (!user.beneficiaries) user.beneficiaries = [];
        const existing = user.beneficiaries.find(b => b.accountNumber === beneficiary.accountNumber);
        if (existing) {
            // Keep the freshest Paystack-resolved details for this beneficiary
            existing.name = beneficiary.name || existing.name;
            existing.bankName = beneficiary.bankName || existing.bankName;
        } else {
            user.beneficiaries.unshift(beneficiary);
        }
    }
};

// ============================================
// Onboarding
// ============================================

const Onboarding = {
    slide: 1,
    total: 4,

    open() {
        this.slide = 1;
        this._render();
        this._checkBiometric();
        Navigation.show('onboarding');
    },

    nextSlide() {
        if (this.slide === 2 && !this._validateContact()) return;
        if (this.slide === 3 && !this._validateCredentials()) return;
        if (this.slide < this.total) {
            this.slide++;
            this._render();
        }
    },

    skip() {
        Navigation.show('login');
    },

    _render() {
        document.querySelectorAll('.onboarding-slide').forEach(s => {
            s.style.display = Number(s.dataset.slide) === this.slide ? 'flex' : 'none';
        });
        const fill = document.getElementById('onboarding-progress-fill');
        if (fill) fill.style.width = ((this.slide / this.total) * 100) + '%';
        const dots = document.getElementById('onboarding-dots');
        if (dots) {
            let html = '';
            for (let i = 1; i <= this.total; i++) {
                html += '<span class="progress-dot' + (i <= this.slide ? ' active' : '') + '"></span>';
            }
            dots.innerHTML = html;
        }
        const skipBtn = document.getElementById('skip-btn');
        if (skipBtn) skipBtn.style.display = this.slide >= this.total ? 'none' : 'block';
    },

    _validateContact() {
        const phone = (document.getElementById('onb-phone').value || '').trim();
        const email = (document.getElementById('onb-email').value || '').trim();
        if (!/^0?\d{10,11}$/.test(phone)) {
            Toast.show('Please enter a valid phone number', 'error');
            return false;
        }
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
            Toast.show('Please enter a valid email address', 'error');
            return false;
        }
        return true;
    },

    _validateCredentials() {
        const pw = document.getElementById('onb-password').value;
        const pw2 = document.getElementById('onb-confirm-password').value;
        const pin = document.getElementById('onb-pin').value;
        const pin2 = document.getElementById('onb-confirm-pin').value;
        if (pw.length < 8) { Toast.show('Password must be at least 8 characters', 'error'); return false; }
        if (pw !== pw2) { Toast.show('Passwords do not match', 'error'); return false; }
        if (!/^\d{4}$/.test(pin)) { Toast.show('PIN must be exactly 4 digits', 'error'); return false; }
        if (pin !== pin2) { Toast.show('PINs do not match', 'error'); return false; }
        return true;
    },

    _checkBiometric() {
        const info = Api.sync('isBiometricAvailable', []);
        const toggle = document.getElementById('onb-biometric');
        const desc = document.getElementById('onb-biometric-desc');
        try {
            const parsed = typeof info === 'string' ? JSON.parse(info) : info;
            if (parsed && !parsed.available) {
                toggle.checked = false;
                toggle.disabled = true;
                desc.textContent = 'Biometric hardware not available';
            }
        } catch (e) { /* leave defaults */ }
    },

    createAccount() {
        const phoneRaw = (document.getElementById('onb-phone').value || '').trim();
        const phone = phoneRaw.startsWith('0') ? phoneRaw : '0' + phoneRaw;
        const email = (document.getElementById('onb-email').value || '').trim();
        const password = document.getElementById('onb-password').value;
        const pin = document.getElementById('onb-pin').value;
        const biometric = document.getElementById('onb-biometric').checked;

        if (!this._validateContact() || !this._validateCredentials()) return;

        Toast.show('Creating your account…', 'success');

        Store.load().then(() => {
            if (Store.userByPhone(phone)) {
                Toast.show('Account already exists. Please sign in.', 'error');
                Navigation.show('login');
                return;
            }

            const accountNumber = Api.sync('generateAccountNumber', [phone]);
            const walletAddress = Api.sync('generateWalletAddress', []);
            const passwordHash = btoa(password);
            const pinHash = Api.sync('hashPin', [pin]);
            const now = new Date().toISOString();
            const fullName = email.split('@')[0].replace(/[._-]+/g, ' ')
                .replace(/\b\w/g, c => c.toUpperCase());

            const user = {
                accountNumber: accountNumber,
                phoneNumber: phone,
                email: email,
                fullName: fullName,
                passwordHash: passwordHash,
                pinHash: pinHash,
                walletAddress: walletAddress,
                balance: 5000000.00,
                bvn: '22' + String(Math.floor(Math.random() * 1e9)).padStart(9, '0'),
                avatarUrl: '',
                createdAt: now,
                biometricEnabled: biometric,
                themePreference: 'dark',
                paystackApiKey: '',
                notifications: { creditSms: true, debitSms: true, push: true },
                transactions: [],
                beneficiaries: [],
                cards: []
            };

            const bonusTxn = {
                id: Api.sync('generateTransactionId', []),
                type: 'credit',
                amount: 5000000.00,
                description: 'Welcome Bonus',
                senderName: 'Goldltm',
                senderAccount: 'SYSTEM',
                balanceAfter: 5000000.00,
                timestamp: now,
                status: 'successful',
                receiptNo: Api.sync('generateReceiptNo', []),
                reference: Api.sync('generateReference', [])
            };
            user.transactions.push(bonusTxn);

            Store.binData.users[accountNumber] = user;
            return Store.save().then(() => {
                Session.saveUser(user);
                Session.set('pin_hash', pinHash);
                Session.setLoggedIn(true);
                Session.set('onboarding_complete', 'true');

                // Credit SMS alert to the new user (Termii, Sender ID: Goldltm)
                Sms.sendCreditAlert(Utils.phoneFromAccount(accountNumber), 5000000.00,
                    'Goldltm', 'SYSTEM', 'Welcome Bonus', 5000000.00,
                    bonusTxn.id, bonusTxn.reference);

                Receipt.show(bonusTxn, user, 'Account Opening - Welcome Bonus');
                Navigation.show('receipt');
                Toast.show('Welcome to Goldltm! ₦5,000,000.00 bonus credited', 'success');
            });
        }).catch(err => {
            Toast.show('Could not create account: ' + err.message, 'error');
        });
    }
};

// ============================================
// SMS (Termii credit alerts only)
// ============================================

const Sms = {
    sendCreditAlert(toPhone, amount, senderName, senderAccount, type, balanceAfter, txnId, reference) {
        if (!Utils.hasAndroid) return;
        toPhone = Utils.toInternationalPhone(toPhone);
        const now = new Date().toISOString();
        const message =
            'Credit Alert\n\n' +
            'Amount: ' + Utils.naira(amount) + '\n' +
            'From: ' + senderName + ' (' + senderAccount + ')\n' +
            'Date: ' + Utils.formatDate(now) + '\n' +
            'Time: ' + Utils.formatTime(now) + '\n' +
            'Transaction Type: ' + type + '\n' +
            'Available Balance: ' + (balanceAfter === null || balanceAfter === undefined ? 'N/A' : Utils.naira(balanceAfter)) + '\n' +
            'Transaction ID: ' + txnId + '\n' +
            'Reference: ' + reference + '\n\n' +
            'Thank you for using Goldltm.';

        Api.call('sendCreditSms', [toPhone, message], (channel, data) => {
            // Surface delivery problems (e.g. missing Termii key) instead of failing silently
            if (channel === 'sms_error') {
                console.warn('Credit alert SMS failed:', data && data.error);
                Toast.show('Credit alert SMS could not be sent', 'error');
            }
        });
    }
};

// ============================================
// Auth (login / forgot PIN)
// ============================================

const Auth = {
    login() {
        const phoneRaw = (document.getElementById('login-phone').value || '').trim();
        const phone = phoneRaw.startsWith('0') || !phoneRaw ? phoneRaw : '0' + phoneRaw;
        const pin = document.getElementById('login-pin').value;

        if (!/^0?\d{10,11}$/.test(phone)) {
            Toast.show('Please enter a valid phone number', 'error');
            return;
        }
        if (!/^\d{4}$/.test(pin)) {
            Toast.show('Please enter your 4-digit PIN', 'error');
            return;
        }

        Toast.show('Signing in…', 'success');

        Store.load().then(() => {
            const user = Store.userByPhone(phone);
            if (!user) {
                Toast.show('Invalid phone number or PIN', 'error');
                document.getElementById('login-pin').value = '';
                return;
            }

            const pinOk = (user.pinHash && Api.sync('verifyPinHash', [pin, user.pinHash])) || user.pin === pin;
            if (!pinOk) {
                Toast.show('Invalid phone number or PIN', 'error');
                document.getElementById('login-pin').value = '';
                return;
            }

            Session.saveUser(user);
            // Legacy users stored a plaintext transactionPin (mapped to user.pin
            // by Store.normalize); upgrade it to a hash so PIN-gated actions
            // (transfers, change PIN) keep working.
            if (!user.pinHash && user.pin) {
                user.pinHash = Api.sync('hashPin', [pin]);
                Store.save().catch(() => { /* non-fatal */ });
            }
            Session.set('pin_hash', user.pinHash || '');
            Session.setLoggedIn(true);
            BottomNav.go('home');
            Toast.show('Welcome back, ' + (user.fullName || 'User'), 'success');
        }).catch(err => {
            Toast.show('Could not sign in: ' + err.message, 'error');
        });
    },

    resetPin() {
        const email = (document.getElementById('forgot-email').value || '').trim();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
            Toast.show('Please enter a valid email address', 'error');
            return;
        }
        Toast.show('PIN reset link sent (demo mode - no email is actually sent)', 'success');
        Navigation.show('login');
    },

    // Shows the fingerprint button when biometric login is enabled + usable
    refreshBiometric() {
        const state = Biometric.refresh();
        const btn = document.getElementById('login-biometric-btn');
        if (btn) btn.style.display = (state.loginEnabled && state.available) ? 'flex' : 'none';
        const phoneInput = document.getElementById('login-phone');
        if (phoneInput && !phoneInput.value && Session.phoneNumber) phoneInput.value = Session.phoneNumber;
    }
};

// ============================================
// Biometric (AndroidX BiometricPrompt via native bridge)
// ============================================

const Biometric = {
    state: { available: false, status: '', loginEnabled: false, transferEnabled: false },
    transferUsePin: false,     // user chose "Use PIN instead" for the next transfer
    _loginErrorCb: null,
    _transfer: null,           // pending confirmation { amount, recipient, onConfirmed, onFailed }
    _lastNonce: '',

    // Re-sync flags + hardware availability from the native layer (source of truth)
    refresh() {
        if (!Utils.hasAndroid) return this.state;
        try {
            const info = JSON.parse(Api.sync('isBiometricAvailable', []) || '{}');
            this.state.available = !!(info && info.available);
            this.state.status = (info && info.status) || '';
        } catch (e) {
            this.state.available = false;
        }
        this.state.loginEnabled = Api.sync('isBiometricLoginEnabled', []) === true;
        this.state.transferEnabled = Api.sync('isBiometricTransferEnabled', []) === true;
        return this.state;
    },

    availabilityError() {
        if (this.state.available) return null;
        if (this.state.status === 'not_enrolled') {
            return 'No biometric credentials enrolled. Please set up in device settings.';
        }
        return 'Biometric not available on this device';
    },

    _overlay(show, text) {
        const el = document.getElementById('bio-overlay');
        if (el) el.classList.toggle('active', !!show);
        const label = document.getElementById('bio-overlay-text');
        if (label && text) label.textContent = text;
    },

    // ---- Settings toggles ----
    enableLogin() {
        const err = this.availabilityError();
        if (err) { Toast.show(err, 'error'); return false; }
        if (!Session.accountNumber) { Toast.show('Sign in to enable biometric login', 'error'); return false; }
        this._overlay(true, 'Confirm to enable biometric login\u2026');
        Android.enableBiometricLogin(Session.accountNumber + '|' + (Session.email || ''));
        return true;
    },

    disableLogin() {
        if (Utils.hasAndroid) Android.disableBiometricLogin();
        this.refresh();
        return true;
    },

    setTransfer(enabled) {
        if (!Utils.hasAndroid) return false;
        if (enabled) {
            const err = this.availabilityError();
            if (err) { Toast.show(err, 'error'); return false; }
            const ok = Android.enableBiometricTransfer() === true;
            if (!ok) { Toast.show('Biometric not available on this device', 'error'); return false; }
            this.transferUsePin = false;
            this.refresh();
            return true;
        }
        Android.disableBiometricTransfer();
        this.refresh();
        return true;
    },

    // ---- Login ----
    login(onError) {
        const err = this.availabilityError();
        if (err) { Toast.show(err, 'error'); if (onError) onError(err); return; }
        if (!Utils.hasAndroid) { if (onError) onError('Bridge unavailable'); return; }
        this._loginErrorCb = onError || null;
        this._overlay(true, 'Authenticating\u2026');
        Android.authenticateBiometricLogin();
    },

    // ---- Transfer confirmation ----
    confirmTransfer(amountStr, recipient, onConfirmed, onFailed) {
        if (!Utils.hasAndroid) { if (onFailed) onFailed('Bridge unavailable'); return; }
        this._transfer = { amount: amountStr, recipient: recipient, onConfirmed: onConfirmed, onFailed: onFailed };
        this._overlay(true, 'Authenticate to confirm');
        Android.authenticateBiometricTransfer(amountStr, recipient);
    }
};

// Native -> JS callbacks (invoked by Kotlin via window.*)
window.onBiometricLoginEnabled = function (enabled, message) {
    Biometric._overlay(false);
    Biometric.refresh();
    const toggle = document.getElementById('bio-login-toggle');
    if (toggle) toggle.checked = (enabled === 'true');
    if (enabled === 'true') {
        Toast.show('Biometric login enabled', 'success');
    } else if (enabled !== 'cancelled') {
        Toast.show(message || 'Biometric login could not be enabled', 'error');
    }
};

window.onBiometricLoginSuccess = function (token) {
    Biometric._overlay(false);
    Biometric._loginErrorCb = null;
    // token = "accountNumber|email" — only recoverable behind the CryptoObject
    const accountNumber = (token || '').split('|')[0] || '';
    Store.load().then(() => {
        const user = Store.userByAccount(accountNumber);
        if (!user) {
            Toast.show('Account not found. Please sign in with your PIN.', 'error');
            return;
        }
        Session.saveUser(user);
        Session.set('pin_hash', user.pinHash || '');
        Session.setLoggedIn(true);
        BottomNav.go('home');
        Toast.show('Welcome back, ' + (user.fullName || 'User'), 'success');
    }).catch(() => {
        Toast.show('Could not sign in. Please try again.', 'error');
    });
};

window.onBiometricLoginError = function (message) {
    Biometric._overlay(false);
    const cb = Biometric._loginErrorCb;
    Biometric._loginErrorCb = null;
    if (message === 'cancelled') {
        // "Use PIN instead" — dismiss silently, PIN form stays on screen
        if (cb) cb(null);
        return;
    }
    Toast.show(message || 'Authentication failed. Try again or use PIN.', 'error');
    if (cb) cb(message);
};

window.onBiometricTransferSuccess = function (token, nonce, amount, recipient) {
    Biometric._overlay(false);
    const pending = Biometric._transfer;
    Biometric._transfer = null;
    if (!pending) return;
    // Bind the confirmation to this exact transaction; reject replays (spec 3.4)
    if (!token || !nonce || nonce === Biometric._lastNonce) {
        Toast.show('Confirmation expired. Please try again.', 'error');
        return;
    }
    if (amount !== pending.amount || recipient !== pending.recipient) {
        Toast.show('Transfer confirmation mismatch. Please try again.', 'error');
        return;
    }
    Biometric._lastNonce = nonce;
    pending.onConfirmed({ token: token, nonce: nonce });
};

window.onBiometricTransferError = function (message) {
    Biometric._overlay(false);
    const pending = Biometric._transfer;
    Biometric._transfer = null;
    if (!pending) return;
    if (message === 'cancelled') {
        // User tapped "Use PIN instead" — fall back quietly
        if (pending.onFailed) pending.onFailed(null);
        return;
    }
    Toast.show(message || 'Authentication failed. Try again or use PIN.', 'error');
    if (pending.onFailed) pending.onFailed(message);
};

// ============================================
// Dashboard
// ============================================

const Dashboard = {
    balanceVisible: true,

    load() {
        // Greeting
        const hour = new Date().getHours();
        let greeting = 'Good evening';
        if (hour < 12) greeting = 'Good morning';
        else if (hour < 17) greeting = 'Good afternoon';
        document.getElementById('greeting-text').textContent = greeting;
        document.getElementById('greeting-name').textContent = (Session.username || 'User').split(' ')[0];
        document.getElementById('header-avatar-text').textContent = Utils.initial(Session.username);
        document.getElementById('balance-account-number').textContent = Session.accountNumber || '---';

        Store.load().then(() => {
            const user = Store.currentUser();
            if (!user) {
                Session.clear();
                Navigation.show('login');
                return;
            }
            this._renderBalance(user.balance);
            this._renderRecent(user);
        }).catch(err => {
            Toast.show('Failed to load account: ' + err.message, 'error');
            this._renderBalance(0);
            document.getElementById('recent-transactions').innerHTML =
                '<div class="empty-state"><div class="empty-state-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div>' +
                '<div class="empty-state-title">Offline</div><div class="empty-state-desc">Could not reach the server. Pull to retry.</div></div>';
        });
    },

    _renderBalance(balance) {
        const el = document.getElementById('balance-amount');
        if (this.balanceVisible) {
            el.classList.remove('hidden');
            el.innerHTML = '<span class="currency">₦</span>' +
                (Number(balance) || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        } else {
            el.classList.add('hidden');
            el.textContent = '₦ ••••••••';
        }
    },

    toggleBalance() {
        this.balanceVisible = !this.balanceVisible;
        document.getElementById('eye-open').style.display = this.balanceVisible ? 'block' : 'none';
        document.getElementById('eye-closed').style.display = this.balanceVisible ? 'none' : 'block';
        const user = Store.currentUser();
        this._renderBalance(user ? user.balance : 0);
    },

    _renderRecent(user) {
        const list = document.getElementById('recent-transactions');
        const txns = (user.transactions || []).slice(0, 5);
        if (txns.length === 0) {
            list.innerHTML = '<div class="empty-state"><div class="empty-state-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg></div>' +
                '<div class="empty-state-title">No transactions yet</div>' +
                '<div class="empty-state-desc">Your transactions will appear here</div></div>';
            return;
        }
        list.innerHTML = txns.map(txn => this._txnHtml(txn)).join('');
    },

    _txnHtml(txn) {
        const credit = txn.type === 'credit';
        const icon = credit
            ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>'
            : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>';
        return '<div class="transaction-item" onclick="Receipt.openFromHistory(\'' + Utils.esc(txn.id) + '\')">' +
            '<div class="transaction-icon ' + (credit ? 'credit' : 'debit') + '">' + icon + '</div>' +
            '<div class="transaction-details">' +
            '<div class="transaction-name">' + Utils.esc(txn.description) + '</div>' +
            '<div class="transaction-meta">' + Utils.timeAgo(txn.timestamp) + '</div>' +
            '</div>' +
            '<div class="transaction-amount ' + (credit ? 'credit' : 'debit') + '">' +
            '<span class="sign">' + (credit ? '+' : '-') + '</span>' + Utils.naira(Math.abs(txn.amount)) +
            '</div></div>';
    }
};

// ============================================
// Transactions history
// ============================================

const Transactions = {
    filter: 'all',

    setFilter(filter, btn) {
        this.filter = filter;
        document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        if (btn) btn.classList.add('active');
        this.load();
    },

    load() {
        Store.load().then(() => {
            const user = Store.currentUser();
            if (!user) return;
            let txns = (user.transactions || []).slice();
            if (this.filter !== 'all') {
                txns = txns.filter(t => t.type === this.filter);
            }
            const list = document.getElementById('all-transactions');
            if (txns.length === 0) {
                list.innerHTML = '<div class="empty-state"><div class="empty-state-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg></div>' +
                    '<div class="empty-state-title">No transactions</div>' +
                    '<div class="empty-state-desc">' + (this.filter === 'all' ? 'Your transactions will appear here' : 'No ' + this.filter + ' transactions') + '</div></div>';
                return;
            }
            // Group by date
            const groups = {};
            txns.forEach(t => {
                const day = Utils.formatDate(t.timestamp);
                if (!groups[day]) groups[day] = [];
                groups[day].push(t);
            });
            let html = '';
            for (const day in groups) {
                html += '<div class="transactions-group"><div class="transactions-group-date">' + Utils.esc(day) + '</div>';
                html += groups[day].map(t => Dashboard._txnHtml(t)).join('');
                html += '</div>';
            }
            list.innerHTML = html;
        }).catch(() => {
            Toast.show('Failed to load transactions', 'error');
        });
    }
};

// ============================================
// Cards (mock)
// ============================================

const Cards = {
    brandKey(card) {
        const raw = ((card && card.brand) || '').toLowerCase();
        if (raw.includes('visa')) return 'visa';
        if (raw.includes('master')) return 'mastercard';
        return 'verve';
    },

    brandName(key) {
        return key === 'visa' ? 'Visa' : key === 'mastercard' ? 'Mastercard' : 'Verve';
    },

    // Realistic card face — used in the list and in the details sheet.
    visualHtml(card, i, opts) {
        opts = opts || {};
        const key = this.brandKey(card);
        const name = this.brandName(key);
        const blocked = !!card.blocked;
        const last4 = String(card.last4 || '0000');
        const holder = String(card.holder || Session.username || 'GOLDLTM MEMBER').toUpperCase();
        const alias = String(card.alias || '').trim();
        const click = opts.static ? '' : ' onclick="Cards.openDetail(' + i + ')"';
        return '<div class="card-visual ' + key + (blocked ? ' is-blocked' : '') + '"' + click + '>' +
            '<div class="card-visual-shine"></div>' +
            '<div class="card-visual-head">' +
                '<div class="card-visual-chip"><span></span></div>' +
                '<svg class="card-visual-wave" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12a7 7 0 017-7"/><path d="M8.5 12a3.5 3.5 0 013.5-3.5"/><path d="M12 12a0 0 0 010 0"/></svg>' +
                '<img class="card-visual-logo" src="logos/' + key + '.svg" alt="' + name + '" onerror="this.style.display=\'none\'">' +
            '</div>' +
            (alias ? '<div class="card-visual-alias">' + Utils.esc(alias) + '</div>' : '') +
            '<div class="card-visual-number"><span>••••</span> <span>••••</span> <span>••••</span> <span>' + Utils.esc(last4) + '</span></div>' +
            '<div class="card-visual-foot">' +
                '<div class="cv-field"><span class="cv-label">Card Holder</span><span class="cv-value">' + Utils.esc(holder) + '</span></div>' +
                '<div class="cv-field"><span class="cv-label">Expires</span><span class="cv-value">' + Utils.esc(card.expiry || '--/--') + '</span></div>' +
                '<span class="card-visual-badge ' + (blocked ? 'blocked' : 'active') + '">' + (blocked ? 'Blocked' : 'Active') + '</span>' +
            '</div>' +
        '</div>';
    },

    load() {
        Store.load().then(() => {
            const user = Store.currentUser();
            const cards = (user && user.cards) || [];
            const container = document.getElementById('cards-list-content');
            if (cards.length === 0) {
                container.innerHTML = '<div class="empty-state"><div class="empty-state-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg></div>' +
                    '<div class="empty-state-title">No cards yet</div>' +
                    '<div class="empty-state-desc">Add a card to get started (demo cards are simulated)</div></div>';
                return;
            }
            container.innerHTML = cards.map((card, i) => this.visualHtml(card, i)).join('');
        }).catch(() => Toast.show('Failed to load cards', 'error'));
    },

    addCard() {
        const number = (window.prompt('Enter 16-digit card number (demo: any digits)') || '').replace(/\D/g, '');
        if (number.length !== 16) {
            Toast.show('Please enter a valid 16-digit card number', 'error');
            return;
        }
        const expiry = (window.prompt('Enter expiry as MM/YY') || '').trim();
        if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry)) {
            Toast.show('Expiry must be in MM/YY format', 'error');
            return;
        }
        Store.load().then(() => {
            const user = Store.currentUser();
            if (!user) return;
            if (!user.cards) user.cards = [];
            // Brand from the IIN: 4… → Visa, 5…/2… → Mastercard, everything else → Verve
            const brand = number[0] === '4' ? 'Visa'
                : (number[0] === '5' || number[0] === '2') ? 'Mastercard'
                : 'Verve';
            user.cards.push({
                last4: number.slice(-4),
                expiry: expiry,
                brand: brand,
                alias: '',
                holder: Session.username || '',
                blocked: false,
                addedAt: new Date().toISOString()
            });
            return Store.save().then(() => {
                Toast.show('Card added (simulated)', 'success');
                this.load();
            });
        }).catch(() => Toast.show('Failed to add card', 'error'));
    },

    toggleBlock(index) {
        Store.load().then(() => {
            const user = Store.currentUser();
            if (!user || !user.cards || !user.cards[index]) return;
            user.cards[index].blocked = !user.cards[index].blocked;
            return Store.save().then(() => {
                Toast.show(user.cards[index].blocked ? 'Card blocked' : 'Card unblocked', 'success');
                this.load();
            });
        }).catch(() => Toast.show('Failed to update card', 'error'));
    },

    // ---- Card details / settings sheet ----
    openDetail(i) {
        Store.load().then(() => {
            const user = Store.currentUser();
            const card = user && user.cards && user.cards[i];
            if (!card) return;
            this._detail = i;
            this._detailCard = card;
            document.getElementById('card-detail-alias').value = card.alias || '';
            document.getElementById('card-detail-expiry').value = card.expiry || '';
            this._refreshDetail();
            document.getElementById('card-detail-overlay').classList.add('active');
        }).catch(() => Toast.show('Could not open card details', 'error'));
    },

    _refreshDetail() {
        const card = this._detailCard;
        if (!card) return;
        const blocked = !!card.blocked;
        document.getElementById('card-detail-visual').innerHTML = this.visualHtml(card, this._detail, { static: true });
        document.getElementById('card-detail-status').innerHTML =
            '<span class="card-visual-badge ' + (blocked ? 'blocked' : 'active') + '">' + (blocked ? 'Blocked' : 'Active') + '</span>' +
            '<span class="card-detail-status-hint">' + (blocked ? 'This card cannot be used for payments' : 'This card is ready to use') + '</span>';
        document.getElementById('card-detail-block-btn').textContent = blocked ? 'Unblock Card' : 'Block Card';
    },

    closeDetail(e) {
        if (e && e.target !== e.currentTarget) return;
        const overlay = document.getElementById('card-detail-overlay');
        if (overlay) overlay.classList.remove('active');
        this._detail = null;
        this._detailCard = null;
    },

    saveDetail() {
        const i = this._detail;
        if (i === null || i === undefined) return;
        const alias = (document.getElementById('card-detail-alias').value || '').trim().slice(0, 24);
        const expiry = (document.getElementById('card-detail-expiry').value || '').trim();
        if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry)) {
            Toast.show('Expiry must be in MM/YY format', 'error');
            return;
        }
        Store.load().then(() => {
            const user = Store.currentUser();
            if (!user || !user.cards || !user.cards[i]) return;
            user.cards[i].alias = alias;
            user.cards[i].expiry = expiry;
            return Store.save().then(() => {
                this.closeDetail();
                this.load();
                Toast.show('Card details updated', 'success');
            });
        }).catch(() => Toast.show('Failed to save card details', 'error'));
    },

    detailToggleBlock() {
        const i = this._detail;
        if (i === null || i === undefined) return;
        Store.load().then(() => {
            const user = Store.currentUser();
            if (!user || !user.cards || !user.cards[i]) return;
            user.cards[i].blocked = !user.cards[i].blocked;
            this._detailCard = user.cards[i];
            return Store.save().then(() => {
                this._refreshDetail();
                this.load();
                Toast.show(user.cards[i].blocked ? 'Card blocked' : 'Card unblocked', 'success');
            });
        }).catch(() => Toast.show('Failed to update card', 'error'));
    },

    deleteCard() {
        const i = this._detail;
        if (i === null || i === undefined) return;
        if (!window.confirm('Delete this card permanently?')) return;
        Store.load().then(() => {
            const user = Store.currentUser();
            if (!user || !user.cards || !user.cards[i]) return;
            user.cards.splice(i, 1);
            return Store.save().then(() => {
                this.closeDetail();
                this.load();
                Toast.show('Card deleted', 'success');
            });
        }).catch(() => Toast.show('Failed to delete card', 'error'));
    }
};

// ============================================
// Profile
// ============================================

const Profile = {
    load() {
        document.getElementById('profile-name').textContent = Session.username || 'User';
        document.getElementById('profile-email').textContent = Session.email || '---';
        document.getElementById('profile-fullname').textContent = Session.username || '---';
        document.getElementById('profile-phone').textContent = Session.phoneNumber || '---';
        document.getElementById('profile-email-value').textContent = Session.email || '---';
        document.getElementById('profile-bvn').textContent = Session.bvn || '---';
        document.getElementById('profile-wallet').textContent = Session.walletAddress || '---';
        document.getElementById('profile-account-number').textContent = Session.accountNumber || '---';
        document.getElementById('profile-avatar-text').textContent = Utils.initial(Session.username);

        const avatar = Session.avatarUrl;
        const img = document.getElementById('profile-avatar-img');
        if (avatar) {
            img.src = avatar;
            img.style.display = 'block';
            document.getElementById('profile-avatar-text').style.display = 'none';
        } else {
            img.style.display = 'none';
            document.getElementById('profile-avatar-text').style.display = 'block';
        }
    },

    // ---- Profile editing (name, email, photo) ----
    _photo: null,

    openEdit(focus) {
        this._photo = null;
        const img = document.getElementById('profile-edit-avatar-img');
        const txt = document.getElementById('profile-edit-avatar-text');
        if (Session.avatarUrl) {
            img.src = Session.avatarUrl;
            img.style.display = 'block';
            txt.style.display = 'none';
        } else {
            img.style.display = 'none';
            txt.style.display = 'block';
            txt.textContent = Utils.initial(Session.username);
        }
        document.getElementById('profile-edit-name').value = Session.username || '';
        document.getElementById('profile-edit-email').value = Session.email || '';
        document.getElementById('profile-edit-overlay').classList.add('active');
        if (focus === 'name') {
            setTimeout(() => document.getElementById('profile-edit-name').focus(), 200);
        }
    },

    closeEdit(e) {
        if (e && e.target !== e.currentTarget) return;
        const overlay = document.getElementById('profile-edit-overlay');
        if (overlay) overlay.classList.remove('active');
        this._photo = null;
    },

    pickPhoto() {
        const onImage = (channel, data) => {
            if (channel === 'image_result' && data && data.base64) {
                this._photo = 'data:image/jpeg;base64,' + data.base64;
                const img = document.getElementById('profile-edit-avatar-img');
                img.src = this._photo;
                img.style.display = 'block';
                document.getElementById('profile-edit-avatar-text').style.display = 'none';
                Toast.show('Photo ready — tap Save Profile', 'success');
            }
        };
        const choice = window.prompt('Choose photo source: type "camera" or "gallery"');
        if (choice === 'camera') {
            Api.call('launchCamera', [], onImage);
        } else if (choice === 'gallery') {
            Api.call('launchGallery', [], onImage);
        } else if (choice !== null) {
            Toast.show('Enter "camera" or "gallery"', 'error');
        }
    },

    saveEdit() {
        const name = (document.getElementById('profile-edit-name').value || '').trim().replace(/\s+/g, ' ');
        const email = (document.getElementById('profile-edit-email').value || '').trim();
        if (name.length < 2 || !/[A-Za-z]/.test(name)) {
            Toast.show('Please enter a valid full name', 'error');
            return;
        }
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            Toast.show('Please enter a valid email address', 'error');
            return;
        }
        Session.set('username', name);
        if (email) Session.set('user_email', email);
        if (this._photo) Session.set('avatar_url', this._photo);
        const photo = this._photo;
        this._photo = null;
        Store.load().then(() => {
            const user = Store.currentUser();
            if (user) {
                user.fullName = name;
                if (email) user.email = email;
                if (photo) user.avatarUrl = photo;
                return Store.save();
            }
        }).catch(() => { /* local session still updated */ }).then(() => {
            this.load();
            this.closeEdit();
            Toast.show('Profile updated', 'success');
        });
    },

    logout() {
        if (!window.confirm('Are you sure you want to logout?')) return;
        Session.clear();
        document.getElementById('login-phone').value = '';
        document.getElementById('login-pin').value = '';
        Navigation.show('login');
        Toast.show('Logged out successfully', 'success');
    }
};

// ============================================
// Settings
// ============================================

const Settings = {
    load() {
        const theme = Session.get('theme_preference', 'dark');
        document.getElementById('theme-toggle').checked = (theme !== 'light');

        const paystackKey = Session.get('paystack_api_key', '');
        document.getElementById('paystack-key-status').textContent = paystackKey ? 'Saved' : 'Not set';
        document.getElementById('paystack-key-input').value = paystackKey;
        document.getElementById('paystack-warning').style.display = paystackKey ? 'none' : 'flex';

        const notifs = this._notifs();
        document.getElementById('notif-credit-sms').checked = notifs.creditSms;
        document.getElementById('notif-push').checked = notifs.push;

        const bio = Biometric.refresh();
        const bioLoginToggle = document.getElementById('bio-login-toggle');
        const bioTransferToggle = document.getElementById('bio-transfer-toggle');
        if (bioLoginToggle) bioLoginToggle.checked = !!bio.loginEnabled;
        if (bioTransferToggle) bioTransferToggle.checked = !!bio.transferEnabled;

        document.getElementById('settings-app-version').textContent = Api.sync('getAppVersion', []) || '1.0.0';
        document.getElementById('settings-bin-id').textContent = Store.binId();
    },

    _notifs() {
        try {
            return JSON.parse(Session.get('notifications', '{"creditSms":true,"debitSms":true,"push":true}'));
        } catch (e) {
            return { creditSms: true, debitSms: true, push: true };
        }
    },

    toggleTheme(darkChecked) {
        // toggle checked = dark mode on
        const theme = darkChecked ? 'dark' : 'light';
        Session.set('theme_preference', theme);
        if (theme === 'light') {
            document.documentElement.setAttribute('data-theme', 'light');
        } else {
            document.documentElement.removeAttribute('data-theme');
        }
        Toast.show(theme === 'dark' ? 'Dark mode enabled' : 'Light mode enabled', 'success');
    },

    toggleNotif(key, value) {
        const notifs = this._notifs();
        notifs[key] = value;
        Session.set('notifications', JSON.stringify(notifs));
        Toast.show('Notification preference updated', 'success');
    },

    savePaystackKey() {
        const key = (document.getElementById('paystack-key-input').value || '').trim();
        if (!key) {
            Toast.show('Enter a Paystack secret key first', 'error');
            return;
        }
        Session.set('paystack_api_key', key);
        document.getElementById('paystack-key-input').value = '';
        document.getElementById('paystack-key-status').textContent = 'Saved';
        document.getElementById('paystack-warning').style.display = 'none';
        Toast.show('Paystack API key saved — verifying…', 'success');
        // Verify the key against the live Paystack bank list (~100+ NGN banks)
        Api.call('getBankList', [], (channel, data) => {
            if (channel === 'bank_list' && Array.isArray(data) && data.length > 20) {
                Toast.show('Paystack key verified — bank list updated', 'success');
                SendMoney.applyBankList(data);
            } else {
                document.getElementById('paystack-key-status').textContent = 'Saved (unverified)';
                Toast.show('Key saved but not verified — double-check it in your Paystack dashboard', 'error');
            }
        });
    },

    clearPaystackKey() {
        Session.remove('paystack_api_key');
        document.getElementById('paystack-key-input').value = '';
        document.getElementById('paystack-key-status').textContent = 'Not set';
        document.getElementById('paystack-warning').style.display = 'flex';
        Toast.show('Paystack API key cleared', 'success');
    },

    toggleBiometricLogin(checked) {
        if (checked) {
            const started = Biometric.enableLogin();
            if (!started) {
                const t = document.getElementById('bio-login-toggle');
                if (t) t.checked = false;
            }
            // Success/cancel/error arrives via window.onBiometricLoginEnabled
        } else {
            Biometric.disableLogin();
            Toast.show('Biometric login disabled', 'success');
        }
    },

    toggleBiometricTransfer(checked) {
        const ok = Biometric.setTransfer(checked);
        const t = document.getElementById('bio-transfer-toggle');
        if (t) t.checked = !!ok && checked;
        if (ok && checked) Toast.show('Biometric confirmation required for transfers', 'success');
        else if (ok && !checked) Toast.show('Transfers now confirmed with PIN only', 'success');
    }
};

// ============================================
// Security Centre
// ============================================

const Security = {
    load() {
        try {
            const bio = Biometric.refresh();
            document.getElementById('security-biometric-status').textContent =
                bio.loginEnabled ? 'Enabled' : (bio.available ? 'Off' : 'Unavailable');
            document.getElementById('security-biometric-desc').textContent =
                bio.loginEnabled ? 'Biometric login is on \u2014 tap to manage in Settings'
                    : (bio.available ? 'Fingerprint unlock supported on this device' : 'No biometric hardware detected');
        } catch (e) { /* defaults */ }
        try {
            const device = JSON.parse(Api.sync('getDeviceInfo', []) || '{}');
            document.getElementById('security-device-info').textContent =
                (device.brand || '') + ' ' + (device.model || '') + ' · ' + (device.osVersion || '');
        } catch (e) { /* defaults */ }
    },

    changePin() {
        PinEntry.request('Enter current PIN', (oldPin) => {
            if (!Api.sync('verifyPinHash', [oldPin, Session.pinHash])) {
                Toast.show('Current PIN is incorrect', 'error');
                return;
            }
            PinEntry.request('Enter new PIN', (newPin) => {
                PinEntry.request('Confirm new PIN', (confirmPin) => {
                    if (newPin !== confirmPin) {
                        Toast.show('PINs do not match', 'error');
                        return;
                    }
                    const pinHash = Api.sync('hashPin', [newPin]);
                    Store.load().then(() => {
                        const user = Store.currentUser();
                        if (!user) return;
                        user.pinHash = pinHash;
                        return Store.save().then(() => {
                            Session.set('pin_hash', pinHash);
                            Toast.show('Transaction PIN updated successfully', 'success');
                        });
                    }).catch(() => Toast.show('Failed to update PIN', 'error'));
                });
            });
        });
    },

    changePassword() {
        const current = window.prompt('Enter current password:');
        if (!current) return;
        Store.load().then(() => {
            const user = Store.currentUser();
            if (!user) return;
            if (btoa(current) !== user.passwordHash) {
                Toast.show('Current password is incorrect', 'error');
                return;
            }
            const next = window.prompt('Enter new password (min 8 characters):');
            if (!next || next.length < 8) {
                Toast.show('Password must be at least 8 characters', 'error');
                return;
            }
            const confirm = window.prompt('Confirm new password:');
            if (next !== confirm) {
                Toast.show('Passwords do not match', 'error');
                return;
            }
            user.passwordHash = btoa(next);
            return Store.save().then(() => {
                Toast.show('Password updated successfully', 'success');
            });
        }).catch(() => Toast.show('Failed to update password', 'error'));
    }
};

// ============================================
// Shared transfer engine
// ============================================

const Transfers = {
    // opts: { pin, amount, description, txnType, recipientName, recipientAccount,
    //         bankName, creditUser (bin user object or null), senderPhone }
    // Biometric-confirmed transfers skip PIN validation — the CryptoObject token
    // binds this exact amount|recipient|nonce|timestamp in the Android Keystore.
    execute(opts, onDone, onError) {
        const bioVerified = !!opts.biometricVerified && !!opts.biometricToken;
        if (!bioVerified) {
            if (!/^\d{4}$/.test(opts.pin || '')) {
                if (onError) onError('Please enter your 4-digit PIN');
                return;
            }
            if (!Api.sync('verifyPinHash', [opts.pin, Session.pinHash])) {
                if (onError) onError('Incorrect transaction PIN');
                return;
            }
        }
        const amount = Number(opts.amount);
        if (!amount || amount <= 0) {
            if (onError) onError('Please enter a valid amount');
            return;
        }

        Store.load().then(() => {
            const sender = Store.currentUser();
            if (!sender) throw new Error('Session expired. Please sign in again.');

            if (amount > (Number(sender.balance) || 0)) {
                throw new Error('Insufficient funds');
            }

            const now = new Date().toISOString();
            const txnId = Api.sync('generateTransactionId', []);
            const reference = Api.sync('generateReference', []);
            const receiptNo = Api.sync('generateReceiptNo', []);

            sender.balance = (Number(sender.balance) || 0) - amount;
            const debitTxn = {
                id: txnId,
                type: 'debit',
                amount: amount,
                description: opts.description,
                recipientName: opts.recipientName || '',
                recipientAccount: opts.recipientAccount || '',
                bankName: opts.bankName || 'Goldltm Wallet',
                senderName: sender.fullName,
                senderAccount: sender.accountNumber,
                balanceAfter: sender.balance,
                timestamp: now,
                status: 'successful',
                txnType: opts.txnType || 'Wallet Transfer',
                receiptNo: receiptNo,
                reference: reference,
                biometricVerified: bioVerified
            };
            if (bioVerified) debitTxn.biometricToken = opts.biometricToken;
            Store.addTransaction(sender, debitTxn);

            let creditPhone = null;
            if (opts.creditUser) {
                const recipient = opts.creditUser;
                recipient.balance = (Number(recipient.balance) || 0) + amount;
                const creditTxn = {
                    id: txnId + '_CR',
                    type: 'credit',
                    amount: amount,
                    description: opts.description,
                    senderName: sender.fullName,
                    senderAccount: sender.accountNumber,
                    balanceAfter: recipient.balance,
                    timestamp: now,
                    status: 'successful',
                    txnType: opts.txnType || 'Wallet Transfer',
                    receiptNo: receiptNo,
                    reference: reference
                };
                Store.addTransaction(recipient, creditTxn);
                Store.addBeneficiary(recipient, {
                    name: sender.fullName,
                    accountNumber: sender.accountNumber,
                    bankName: 'Goldltm Wallet',
                    type: 'app'
                });
                creditPhone = recipient.phoneNumber;
            }

            if (opts.saveBeneficiary && opts.recipientAccount) {
                Store.addBeneficiary(sender, {
                    name: opts.recipientName || 'Unknown',
                    accountNumber: opts.recipientAccount,
                    bankName: opts.bankName || 'Goldltm Wallet',
                    type: opts.bankName && opts.bankName !== 'Goldltm Wallet' ? 'bank' : 'app'
                });
            }

            return Store.save().then(() => {
                const smsAllowed = Session.get('notifications', '{"creditSms":true}').indexOf('"creditSms":true') !== -1;
                // Credit SMS alert to the Goldltm recipient (Termii, Sender ID: Goldltm)
                if (creditPhone && smsAllowed) {
                    Sms.sendCreditAlert(Utils.phoneFromAccount(creditPhone), amount,
                        sender.fullName, sender.accountNumber, opts.txnType || 'Wallet Transfer',
                        opts.creditUser.balance, txnId, reference);
                }
                // Mobile-bank recipients (OPay, PalmPay, Kuda, Moniepoint, ...) use their
                // phone number as their account number, so the credit alert SMS goes to
                // that number without the leading zero (+234...). Traditional banks get none.
                if (!opts.creditUser && opts.isMobileBank && opts.recipientAccount && smsAllowed) {
                    Sms.sendCreditAlert(Utils.toInternationalPhone(opts.recipientAccount), amount,
                        sender.fullName, sender.accountNumber, opts.txnType || 'Bank Transfer',
                        null, txnId, reference);
                }
                onDone(debitTxn, sender);
            });
        }).catch(err => {
            if (onError) onError(err.message || 'Transfer failed');
        });
    },

    // Gates any transfer behind biometric confirmation when enabled in Settings
    // (spec 3.3). Falls back to the PIN flow on cancel/failure — the inline PIN
    // field stays visible, so the next Confirm tap uses the PIN directly.
    executeWithAuth(opts, onDone, onError) {
        const state = Biometric.refresh();
        if (!state.transferEnabled || !state.available) {
            this.execute(opts, onDone, onError);
            return;
        }
        if (Biometric.transferUsePin) {
            // User chose "Use PIN instead" for this transaction
            Biometric.transferUsePin = false;
            this.execute(opts, onDone, onError);
            return;
        }
        const recipientLabel = opts.recipientName || opts.recipientAccount || 'recipient';
        Biometric.confirmTransfer(Utils.naira(opts.amount), recipientLabel, (result) => {
            Biometric.transferUsePin = false;
            this.execute(Object.assign({}, opts, {
                pin: null,
                biometricVerified: true,
                biometricToken: result.token
            }), onDone, onError);
        }, (message) => {
            // null message = user tapped "Use PIN instead" (silent), otherwise the
            // error was already surfaced by the callback handler
            Biometric.transferUsePin = true;
            if (message === null) Toast.show('Enter your transaction PIN to continue', 'success');
        });
    }
};

// ============================================
// Send Money (3 tabs)
// ============================================

const SendMoney = {
    tab: 'app',
    recipient: null,
    banks: [
        // Mobile banks first — their account number is the customer's phone number
        // (codes verified live against Paystack /bank?currency=NGN)
        { code: '999992', name: 'OPay Digital Services (OPay)', mobile: true },
        { code: '999991', name: 'PalmPay', mobile: true },
        { code: '50211', name: 'Kuda Bank', mobile: true },
        { code: '50515', name: 'Moniepoint MFB', mobile: true },
        { code: '50126', name: 'Eyowo', mobile: true },
        { code: '100002', name: 'Paga', mobile: true },
        // Traditional banks (correct Paystack bank codes)
        { code: '044', name: 'Access Bank' },
        { code: '057', name: 'Zenith Bank' },
        { code: '058', name: 'GTBank' },
        { code: '011', name: 'First Bank of Nigeria' },
        { code: '033', name: 'UBA' },
        { code: '032', name: 'Union Bank of Nigeria' },
        { code: '232', name: 'Sterling Bank' },
        { code: '035', name: 'Wema Bank' },
        { code: '070', name: 'Fidelity Bank' },
        { code: '214', name: 'FCMB' },
        { code: '221', name: 'Stanbic IBTC Bank' },
        { code: '082', name: 'Keystone Bank' },
        { code: '076', name: 'Polaris Bank' },
        { code: '101', name: 'Providus Bank' },
        { code: '301', name: 'Jaiz Bank' },
        { code: '215', name: 'Unity Bank' },
        { code: '050', name: 'Ecobank Nigeria' }
    ],

    open() {
        this.recipient = null;
        this.setTab('app');
        document.getElementById('send-wallet-input').value = '';
        document.getElementById('send-bank-account').value = '';
        document.getElementById('send-amount').value = '';
        document.getElementById('send-narration').value = '';
        document.getElementById('send-pin').value = '';
        document.getElementById('send-recipient-card').style.display = 'none';
        document.getElementById('send-bank-recipient-card').style.display = 'none';
        document.getElementById('send-bank-select').value = '';
        this._renderBankPickerBtn(null);
        this._renderBanks();
        this._loadBankList();
        this._loadBeneficiaries();
        this.updateSummary();
        Navigation.show('send-money');
    },

    setTab(tab) {
        this.tab = tab;
        document.querySelectorAll('.send-tab').forEach(t => {
            t.classList.toggle('active', t.dataset.tab === tab);
        });
        document.getElementById('send-app-content').style.display = tab === 'app' ? 'block' : 'none';
        document.getElementById('send-bank-content').style.display = tab === 'bank' ? 'block' : 'none';
        document.getElementById('send-beneficiary-content').style.display = tab === 'beneficiary' ? 'block' : 'none';
    },

    _renderBanks() {
        const select = document.getElementById('send-bank-select');
        const current = select.value;
        select.innerHTML = '<option value="">Choose a bank</option>' +
            this.banks.map(b => '<option value="' + b.code + '">' + Utils.esc(b.name) + '</option>').join('');
        if (current) select.value = current;
        this._renderBankPickerBtn(this.banks.find(b => b.code === select.value) || null);
    },

    // Bundled logo file per bank code (app/src/main/assets/banks/).
    logoFiles: {
        '044': 'access.png', '057': 'zenith.svg', '058': 'gtbank.svg', '011': 'firstbank.svg',
        '033': 'uba.jpg', '032': 'union.png', '232': 'sterling.png', '035': 'wema.svg',
        '070': 'fidelity.png', '214': 'fcmb.png', '221': 'stanbic.png', '082': 'keystone.png',
        '076': 'polaris.png', '101': 'providus.png', '301': 'jaiz.png', '215': 'unity.png',
        '050': 'ecobank.png', '999992': 'opay.png', '999991': 'palmpay.png', '50211': 'kuda.png',
        '50515': 'moniepoint.svg', '50126': 'eyowo.svg', '100002': 'paga.png'
    },

    bankLogoHtml(bank, small) {
        const file = this.logoFiles[bank.code];
        const cls = 'bank-logo-tile' + (small ? ' sm' : '');
        if (file) {
            return '<span class="' + cls + '"><img src="banks/' + file + '" alt="' + Utils.esc(bank.name) +
                '" onerror="SendMoney.logoFallback(this)"></span>';
        }
        return '<span class="' + cls + '">' + this.monoHtml(bank.name) + '</span>';
    },

    // Initials tile with a deterministic brand-ish colour for banks we have no
    // bundled logo for (the live Paystack list has 100+ banks).
    monoHtml(name) {
        const words = String(name || 'Bank').trim().split(/\s+/);
        const initials = words.slice(0, 2).map(w => w.charAt(0).toUpperCase()).join('');
        let h = 0;
        const s = String(name || 'Bank');
        for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
        return '<span class="bank-mono" style="background:hsl(' + h + ',52%,36%)">' + Utils.esc(initials) + '</span>';
    },

    logoFallback(img) {
        const tile = img.parentNode;
        if (tile) tile.innerHTML = this.monoHtml(img.alt || 'Bank');
    },

    openBankPicker() {
        this._bankQuery = '';
        const search = document.getElementById('bank-picker-search');
        if (search) search.value = '';
        this._renderBankPicker();
        document.getElementById('bank-picker-overlay').classList.add('active');
    },

    closeBankPicker(e) {
        if (e && e.target !== e.currentTarget) return;
        document.getElementById('bank-picker-overlay').classList.remove('active');
    },

    filterBanks(q) {
        this._bankQuery = (q || '').toLowerCase();
        this._renderBankPicker();
    },

    _renderBankPicker() {
        const q = this._bankQuery || '';
        const selected = document.getElementById('send-bank-select').value;
        const list = this.banks.filter(b => !q || b.name.toLowerCase().indexOf(q) !== -1 || String(b.code).indexOf(q) !== -1);
        const container = document.getElementById('bank-picker-list');
        if (!list.length) {
            container.innerHTML = '<div class="bank-picker-empty">No banks match “' + Utils.esc(q) + '”</div>';
            return;
        }
        container.innerHTML = list.map(b => {
            const isSel = b.code === selected;
            return '<button type="button" class="bank-row' + (isSel ? ' selected' : '') + '" onclick="SendMoney.pickBank(\'' + b.code + '\')">' +
                this.bankLogoHtml(b) +
                '<span class="bank-row-name">' + Utils.esc(b.name) + '</span>' +
                (b.mobile ? '<span class="bank-row-badge">Mobile</span>' : '') +
                (isSel ? '<svg class="bank-row-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>' : '') +
                '</button>';
        }).join('');
    },

    pickBank(code) {
        const bank = this.banks.find(b => b.code === code);
        if (!bank) return;
        const select = document.getElementById('send-bank-select');
        if (!select.querySelector('option[value="' + code + '"]')) {
            const opt = document.createElement('option');
            opt.value = code;
            opt.textContent = bank.name;
            select.appendChild(opt);
        }
        select.value = code;
        this._renderBankPickerBtn(bank);
        document.getElementById('bank-picker-overlay').classList.remove('active');
        this.onBankSelected();
    },

    _renderBankPickerBtn(bank) {
        const btn = document.getElementById('send-bank-picker-btn');
        if (!btn) return;
        if (!bank) {
            btn.innerHTML = '<span class="bank-picker-placeholder">Choose a bank</span>' +
                '<svg class="bank-picker-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>';
            return;
        }
        btn.innerHTML = this.bankLogoHtml(bank) +
            '<span class="bank-picker-name">' + Utils.esc(bank.name) + '</span>' +
            '<svg class="bank-picker-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>';
    },

    // Merge a live Paystack bank list (source of truth for codes/names) over the
    // static one, flag mobile banks, and cache for offline use.
    applyBankList(list) {
        if (!Array.isArray(list) || !list.length) return;
        const seen = {};
        const merged = list.filter(b => b && b.code && b.name).map(b => {
            seen[b.code] = true;
            return { code: b.code, name: b.name, mobile: Utils.isMobileBank(b.name) };
        });
        if (!merged.length) return;
        this.banks.filter(b => !seen[b.code]).forEach(b => merged.push(b));
        this.banks = merged;
        this._renderBanks();
        // Cache only a real live list (the fetched array is large), never the
        // small built-in fallback that merely got merged with the static one
        if (list && list.length > 20) Session.set('bank_list_cache', JSON.stringify(merged));
    },

    _loadBankList() {
        try {
            const cached = JSON.parse(Session.get('bank_list_cache', ''));
            if (Array.isArray(cached) && cached.length > 20) {
                this.banks = cached;
                this._renderBanks();
            }
        } catch (e) { /* no cache yet */ }

        Api.call('getBankList', [], (channel, data) => {
            if (channel === 'bank_list') this.applyBankList(data);
        });
    },

    _loadBeneficiaries() {
        Store.load().then(() => {
            const user = Store.currentUser();
            const list = (user && user.beneficiaries) || [];
            const container = document.getElementById('beneficiaries-list');
            if (list.length === 0) {
                container.innerHTML = '<div class="empty-state"><div class="empty-state-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg></div>' +
                    '<div class="empty-state-title">No saved beneficiaries</div>' +
                    '<div class="empty-state-desc">Recipients you send money to will be saved here</div></div>';
                return;
            }
            container.innerHTML = list.map((b, i) =>
                '<div class="transaction-item" onclick="SendMoney.pickBeneficiary(' + i + ')">' +
                '<div class="transaction-icon credit">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>' +
                '<div class="transaction-details">' +
                '<div class="transaction-name">' + Utils.esc(b.name) + '</div>' +
                '<div class="transaction-meta">' + Utils.esc(b.accountNumber) + ' · ' + Utils.esc(b.bankName || '') + '</div>' +
                '</div></div>'
            ).join('');
            this._beneficiaries = list;
        }).catch(() => { /* non-fatal */ });
    },

    pickBeneficiary(index) {
        const b = (this._beneficiaries || [])[index];
        if (!b) return;
        if (b.type === 'bank') {
            this.tab = 'bank';
            this.setTab('bank');
            const known = this.banks.find(x => x.name === b.bankName);
            if (known) {
                document.getElementById('send-bank-select').value = known.code;
                this._renderBankPickerBtn(known);
            }
            document.getElementById('send-bank-account').value = b.accountNumber;
            this.recipient = {
                name: b.name,
                accountNumber: b.accountNumber,
                bankName: b.bankName,
                isBank: true,
                isMobileBank: Utils.isMobileBank(b.bankName)
            };
        } else {
            this.setTab('app');
            document.getElementById('send-wallet-input').value = b.accountNumber;
            this._showRecipient(b.name, b.accountNumber);
            this.recipient = { name: b.name, accountNumber: b.accountNumber, user: Store.userByAccount(b.accountNumber) };
        }
        this.updateSummary();
        Toast.show('Beneficiary selected: ' + b.name, 'success');
    },

    fetchRecipient() {
        const input = (document.getElementById('send-wallet-input').value || '').trim();
        if (!input) {
            Toast.show('Enter an account number or wallet address', 'error');
            return;
        }
        Store.load().then(() => {
            let user = null;
            if (input.startsWith('GL_')) user = Store.userByWallet(input);
            else if (input.startsWith('019')) user = Store.userByAccount(input);
            if (!user) user = Store.userByPhone(input.startsWith('0') ? input : '0' + input);

            if (!user) {
                this._showRecipient('Recipient not found', input);
                this.recipient = null;
                this.updateSummary();
                Toast.show('No Goldltm user found for ' + input, 'error');
                return;
            }
            if (user.accountNumber === Session.accountNumber) {
                Toast.show('You cannot send money to yourself', 'error');
                return;
            }
            this._showRecipient(user.fullName || user.phoneNumber, user.accountNumber);
            this.recipient = { name: user.fullName || user.phoneNumber, accountNumber: user.accountNumber, user: user };
            this.updateSummary();
        }).catch(() => Toast.show('Could not verify recipient', 'error'));
    },

    _showRecipient(name, account) {
        document.getElementById('send-recipient-card').style.display = 'flex';
        document.getElementById('send-recipient-name').textContent = name;
        document.getElementById('send-recipient-account').textContent = account;
        document.getElementById('send-recipient-initial').textContent = Utils.initial(name);
    },

    onBankSelected() {
        this.recipient = null;
        document.getElementById('send-bank-recipient-card').style.display = 'none';
        this.updateSummary();
    },

    fetchBankRecipient() {
        const bankCode = document.getElementById('send-bank-select').value;
        const account = (document.getElementById('send-bank-account').value || '').trim();
        if (!bankCode) {
            Toast.show('Please select a bank', 'error');
            return;
        }
        if (!/^\d{10}$/.test(account)) {
            Toast.show('Please enter a valid 10-digit account number', 'error');
            return;
        }
        const bank = this.banks.find(b => b.code === bankCode) || { name: 'Bank' };
        const paystackKey = Session.get('paystack_api_key', '');
        document.getElementById('send-bank-recipient-name').textContent = 'Resolving…';
        document.getElementById('send-bank-recipient-card').style.display = 'flex';

        Api.call('fetchBankName', [bankCode, account, paystackKey], (channel, data) => {
            if (channel === 'bank_name' && data && data.data && data.data.account_name) {
                const name = data.data.account_name;
                document.getElementById('send-bank-recipient-name').textContent = name;
                document.getElementById('send-bank-recipient-account').textContent = account + ' · ' + bank.name;
                // The Paystack-resolved name automatically becomes the recipient
                // name on the transaction, receipt and any saved beneficiary.
                this.recipient = {
                    name: name,
                    accountNumber: account,
                    bankName: bank.name,
                    isBank: true,
                    isMobileBank: !!(bank.mobile || Utils.isMobileBank(bank.name))
                };
                this.updateSummary();
            } else {
                document.getElementById('send-bank-recipient-card').style.display = 'none';
                Toast.show((typeof data === 'string' && data) ? data : 'Could not resolve account name', 'error');
            }
        });
    },

    updateSummary() {
        const amount = Number(document.getElementById('send-amount').value) || 0;
        const narration = (document.getElementById('send-narration').value || '').trim();
        const r = this.recipient;
        let html = '';
        if (r) {
            html += '<div class="send-summary-row"><span class="send-summary-label">To</span><span class="send-summary-value">' + Utils.esc(r.name) + '</span></div>';
            html += '<div class="send-summary-row"><span class="send-summary-label">Account</span><span class="send-summary-value">' + Utils.esc(r.accountNumber) + '</span></div>';
            html += '<div class="send-summary-row"><span class="send-summary-label">Bank</span><span class="send-summary-value">' + Utils.esc(r.bankName || 'Goldltm Wallet') + '</span></div>';
        } else {
            html += '<div class="send-summary-row"><span class="send-summary-label">Recipient</span><span class="send-summary-value" style="color:var(--text-muted)">Not selected</span></div>';
        }
        html += '<div class="send-summary-row"><span class="send-summary-label">Amount</span><span class="send-summary-value">' + Utils.naira(amount) + '</span></div>';
        html += '<div class="send-summary-row"><span class="send-summary-label">Fee</span><span class="send-summary-value">' + Utils.naira(0) + '</span></div>';
        if (narration) {
            html += '<div class="send-summary-row"><span class="send-summary-label">Narration</span><span class="send-summary-value">' + Utils.esc(narration) + '</span></div>';
        }
        html += '<div class="send-summary-total"><span class="send-summary-total-label">Total</span><span class="send-summary-total-value">' + Utils.naira(amount) + '</span></div>';
        document.getElementById('send-summary').innerHTML = html;
    },

    confirm() {
        const r = this.recipient;
        if (!r) {
            Toast.show('Please select a recipient first', 'error');
            return;
        }
        const amount = Number(document.getElementById('send-amount').value) || 0;
        const narration = (document.getElementById('send-narration').value || '').trim();
        const pin = document.getElementById('send-pin').value;
        const bankName = r.bankName || 'Goldltm Wallet';
        const description = narration || (r.isBank ? 'Transfer to ' + bankName : 'Wallet Transfer to ' + r.name);

        Transfers.executeWithAuth({
            pin: pin,
            amount: amount,
            description: description,
            txnType: r.isBank ? 'Bank Transfer' : 'Wallet Transfer',
            recipientName: r.name,
            recipientAccount: r.accountNumber,
            bankName: bankName,
            creditUser: r.user || null,
            isMobileBank: !!r.isMobileBank,
            saveBeneficiary: true
        }, (txn, sender) => {
            document.getElementById('send-pin').value = '';
            Receipt.show(txn, sender, 'Transfer Successful');
            Navigation.show('receipt');
            Toast.show('Transfer successful!', 'success');
        }, (error) => {
            Toast.show(error, 'error');
        });
    }
};

// ============================================
// Airtime
// ============================================

const Airtime = {
    network: null,
    networks: [
        { id: 'mtn', name: 'MTN', logo: 'networks/mtn.svg' },
        { id: 'glo', name: 'Glo', logo: 'networks/glo.png' },
        { id: 'airtel', name: 'Airtel', logo: 'networks/airtel.svg' },
        { id: '9mobile', name: '9mobile', logo: 'networks/9mobile.svg' }
    ],

    open() {
        this.network = null;
        document.getElementById('airtime-phone').value = Session.phoneNumber || '';
        document.getElementById('airtime-amount').value = '';
        document.getElementById('airtime-pin').value = '';
        this._renderNetworks();
        Navigation.show('airtime');
    },

    _renderNetworks() {
        const container = document.getElementById('airtime-networks');
        container.innerHTML = this.networks.map(n =>
            '<button class="network-btn" data-network="' + n.id + '" onclick="Airtime.select(\'' + n.id + '\')">' +
            '<div class="network-icon ' + n.id + '"><span class="network-letter">' + n.name.charAt(0) + '</span><img class="network-logo" src="' + n.logo + '" alt="' + n.name + '" onerror="this.remove()"></div>' +
            '<span class="network-name">' + n.name + '</span></button>'
        ).join('');
    },

    select(id) {
        this.network = this.networks.find(n => n.id === id) || null;
        document.querySelectorAll('#airtime-networks .network-btn').forEach(btn => {
            btn.classList.toggle('selected', btn.dataset.network === id);
        });
    },

    confirm() {
        if (!this.network) {
            Toast.show('Please select a network', 'error');
            return;
        }
        const phone = (document.getElementById('airtime-phone').value || '').trim();
        const amount = Number(document.getElementById('airtime-amount').value) || 0;
        const pin = document.getElementById('airtime-pin').value;
        if (!/^0?\d{10,11}$/.test(phone)) {
            Toast.show('Please enter a valid phone number', 'error');
            return;
        }
        if (amount < 50) {
            Toast.show('Minimum airtime purchase is ' + Utils.naira(50), 'error');
            return;
        }
        Transfers.executeWithAuth({
            pin: pin,
            amount: amount,
            description: 'Airtime - ' + this.network.name + ' (' + phone + ')',
            txnType: 'Airtime',
            recipientName: this.network.name + ' Airtime',
            recipientAccount: phone,
            bankName: this.network.name,
            creditUser: null,
            saveBeneficiary: false
        }, (txn, sender) => {
            Receipt.show(txn, sender, 'Airtime Purchase Successful');
            Navigation.show('receipt');
            Toast.show('Airtime purchased successfully!', 'success');
        }, (error) => Toast.show(error, 'error'));
    }
};

// ============================================
// Data bundles
// ============================================

const Data = {
    network: null,
    plan: null,
    networks: Airtime.networks,
    plans: {
        mtn: [
            { name: '500MB', price: 300, period: '7 days' },
            { name: '1GB', price: 500, period: '30 days' },
            { name: '2GB', price: 900, period: '30 days' },
            { name: '5GB', price: 2000, period: '30 days' }
        ],
        glo: [
            { name: '1GB', price: 450, period: '30 days' },
            { name: '2GB', price: 800, period: '30 days' },
            { name: '3GB', price: 1200, period: '30 days' },
            { name: '5GB', price: 1900, period: '30 days' }
        ],
        airtel: [
            { name: '1GB', price: 500, period: '30 days' },
            { name: '2GB', price: 1000, period: '30 days' },
            { name: '5GB', price: 2500, period: '30 days' },
            { name: '10GB', price: 4000, period: '30 days' }
        ],
        '9mobile': [
            { name: '1GB', price: 480, period: '30 days' },
            { name: '2GB', price: 950, period: '30 days' },
            { name: '3GB', price: 1400, period: '30 days' },
            { name: '5GB', price: 2200, period: '30 days' }
        ]
    },

    open() {
        this.network = null;
        this.plan = null;
        document.getElementById('data-phone').value = Session.phoneNumber || '';
        document.getElementById('data-pin').value = '';
        document.getElementById('data-plans-form').style.display = 'none';
        const container = document.getElementById('data-networks');
        container.innerHTML = this.networks.map(n =>
            '<button class="network-btn" data-network="' + n.id + '" onclick="Data.select(\'' + n.id + '\')">' +
            '<div class="network-icon ' + n.id + '"><span class="network-letter">' + n.name.charAt(0) + '</span><img class="network-logo" src="' + n.logo + '" alt="' + n.name + '" onerror="this.remove()"></div>' +
            '<span class="network-name">' + n.name + '</span></button>'
        ).join('');
        Navigation.show('data');
    },

    select(id) {
        this.network = this.networks.find(n => n.id === id) || null;
        this.plan = null;
        document.querySelectorAll('#data-networks .network-btn').forEach(btn => {
            btn.classList.toggle('selected', btn.dataset.network === id);
        });
        const plans = this.plans[id] || [];
        document.getElementById('data-plans').innerHTML = plans.map((p, i) =>
            '<div class="network-plan" data-plan="' + i + '" onclick="Data.selectPlan(' + i + ')">' +
            '<div><div class="network-plan-amount">' + p.name + ' Data</div>' +
            '<div class="network-plan-period">Valid for ' + p.period + '</div></div>' +
            '<div class="network-plan-amount">' + Utils.naira(p.price) + '</div></div>'
        ).join('');
        document.getElementById('data-plans-form').style.display = 'block';
        this._plans = plans;
    },

    selectPlan(index) {
        this.plan = (this._plans || [])[index] || null;
        document.querySelectorAll('#data-plans .network-plan').forEach(el => {
            el.classList.toggle('selected', Number(el.dataset.plan) === index);
        });
    },

    confirm() {
        if (!this.network || !this.plan) {
            Toast.show('Please select a network and a data plan', 'error');
            return;
        }
        const phone = (document.getElementById('data-phone').value || '').trim();
        const pin = document.getElementById('data-pin').value;
        if (!/^0?\d{10,11}$/.test(phone)) {
            Toast.show('Please enter a valid phone number', 'error');
            return;
        }
        Transfers.executeWithAuth({
            pin: pin,
            amount: this.plan.price,
            description: 'Data - ' + this.network.name + ' ' + this.plan.name + ' (' + phone + ')',
            txnType: 'Data Bundle',
            recipientName: this.network.name + ' Data',
            recipientAccount: phone,
            bankName: this.network.name,
            creditUser: null,
            saveBeneficiary: false
        }, (txn, sender) => {
            Receipt.show(txn, sender, 'Data Purchase Successful');
            Navigation.show('receipt');
            Toast.show('Data bundle purchased successfully!', 'success');
        }, (error) => Toast.show(error, 'error'));
    }
};

// ============================================
// Bills (Electricity, Cable TV, Internet/Education)
// ============================================

const Bills = {
    category: null,
    provider: null,
    bouquet: null,
    providers: {
        electricity: [
            { id: 'ikeja', name: 'Ikeja Electric' },
            { id: 'eko', name: 'Eko Electric' },
            { id: 'ibadan', name: 'Ibadan Electric' },
            { id: 'abuja', name: 'Abuja Electric' },
            { id: 'ph', name: 'Port Harcourt Electric' },
            { id: 'kaduna', name: 'Kaduna Electric' }
        ],
        cable: [
            { id: 'dstv', name: 'DStv' },
            { id: 'gotv', name: 'GOtv' },
            { id: 'startimes', name: 'StarTimes' }
        ],
        internet: [
            { id: 'spectranet', name: 'Spectranet' },
            { id: 'smile', name: 'Smile Communications' },
            { id: 'waec', name: 'WAEC Result Checker' },
            { id: 'jamb', name: 'JAMB e-PIN' }
        ]
    },
    bouquets: {
        dstv: [
            { name: 'DStv Padi', price: 4400 },
            { name: 'DStv Yanga', price: 6000 },
            { name: 'DStv Confam', price: 11000 },
            { name: 'DStv Compact', price: 19000 },
            { name: 'DStv Compact Plus', price: 30000 },
            { name: 'DStv Premium', price: 44500 }
        ],
        gotv: [
            { name: 'GOtv Smallie', price: 1900 },
            { name: 'GOtv Jinja', price: 3900 },
            { name: 'GOtv Jolli', price: 5800 },
            { name: 'GOtv Max', price: 8500 }
        ],
        startimes: [
            { name: 'Nova', price: 1900 },
            { name: 'Basic', price: 4000 },
            { name: 'Smart', price: 5100 },
            { name: 'Classic', price: 6000 },
            { name: 'Super', price: 11500 }
        ],
        spectranet: [
            { name: '10GB Monthly', price: 5000 },
            { name: '20GB Monthly', price: 8000 },
            { name: '50GB Monthly', price: 15000 }
        ],
        smile: [
            { name: '5GB Monthly', price: 3500 },
            { name: '10GB Monthly', price: 6000 },
            { name: '20GB Monthly', price: 10000 }
        ],
        waec: [
            { name: 'WAEC Result Checker PIN', price: 3500 }
        ],
        jamb: [
            { name: 'JAMB e-PIN Registration', price: 5700 }
        ]
    },

    open(category) {
        this.category = category;
        this.provider = null;
        this.bouquet = null;
        const titles = { electricity: 'Electricity', cable: 'Cable TV', internet: 'Internet/Education' };
        document.getElementById('bills-title').textContent = titles[category] || 'Bills Payment';
        document.getElementById('bills-identifier').value = '';
        document.getElementById('bills-amount').value = '';
        document.getElementById('bills-pin').value = '';
        document.getElementById('bills-customer-card').style.display = 'none';
        document.getElementById('bills-bouquet-group').style.display = 'none';

        const idLabels = {
            electricity: 'Meter Number',
            cable: 'Smartcard / IUC Number',
            internet: 'Customer ID / Phone Number'
        };
        document.getElementById('bills-id-label').textContent = idLabels[category] || 'Reference Number';

        const list = this.providers[category] || [];
        document.getElementById('bills-providers').innerHTML = list.map(p =>
            '<div class="network-plan" data-provider="' + p.id + '" onclick="Bills.selectProvider(\'' + p.id + '\')">' +
            '<div><div class="network-plan-amount">' + Utils.esc(p.name) + '</div></div>' +
            '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--text-muted)" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg></div>'
        ).join('');
        Navigation.show('bills');
    },

    selectProvider(id) {
        const list = this.providers[this.category] || [];
        this.provider = list.find(p => p.id === id) || null;
        this.bouquet = null;
        document.querySelectorAll('#bills-providers .network-plan').forEach(el => {
            el.classList.toggle('selected', el.dataset.provider === id);
        });
        const bouquets = this.bouquets[id] || [];
        if (bouquets.length > 0) {
            document.getElementById('bills-bouquets').innerHTML = bouquets.map((b, i) =>
                '<div class="network-plan" data-bouquet="' + i + '" onclick="Bills.selectBouquet(' + i + ')">' +
                '<div><div class="network-plan-amount">' + Utils.esc(b.name) + '</div></div>' +
                '<div class="network-plan-amount">' + Utils.naira(b.price) + '</div></div>'
            ).join('');
            document.getElementById('bills-bouquet-group').style.display = 'block';
            this._bouquets = bouquets;
        } else {
            document.getElementById('bills-bouquet-group').style.display = 'none';
            this._bouquets = [];
        }
    },

    selectBouquet(index) {
        this.bouquet = (this._bouquets || [])[index] || null;
        document.querySelectorAll('#bills-bouquets .network-plan').forEach(el => {
            el.classList.toggle('selected', Number(el.dataset.bouquet) === index);
        });
        if (this.bouquet) {
            document.getElementById('bills-amount').value = this.bouquet.price;
        }
    },

    verifyCustomer() {
        const id = (document.getElementById('bills-identifier').value || '').trim();
        if (id.length < 6) {
            Toast.show('Please enter a valid number', 'error');
            return;
        }
        if (!this.provider) {
            Toast.show('Please select a provider first', 'error');
            return;
        }
        // Mock customer name lookup
        const mockName = 'CUSTOMER ' + id.slice(-4).toUpperCase();
        document.getElementById('bills-customer-name').textContent = mockName;
        document.getElementById('bills-customer-meta').textContent = this.provider.name + ' · ' + id;
        document.getElementById('bills-customer-card').style.display = 'flex';
        Toast.show('Customer verified (simulated)', 'success');
    },

    confirm() {
        if (!this.provider) {
            Toast.show('Please select a provider', 'error');
            return;
        }
        const id = (document.getElementById('bills-identifier').value || '').trim();
        const amount = Number(document.getElementById('bills-amount').value) || 0;
        const pin = document.getElementById('bills-pin').value;
        if (id.length < 6) {
            Toast.show('Please enter a valid reference number', 'error');
            return;
        }
        if (amount <= 0) {
            Toast.show('Please enter a valid amount', 'error');
            return;
        }
        const item = this.bouquet ? this.bouquet.name : this.provider.name;
        const typeLabels = { electricity: 'Electricity', cable: 'Cable TV', internet: 'Internet/Education' };
        Transfers.executeWithAuth({
            pin: pin,
            amount: amount,
            description: item + ' (' + id + ')',
            txnType: typeLabels[this.category] || 'Bills Payment',
            recipientName: item,
            recipientAccount: id,
            bankName: this.provider.name,
            creditUser: null,
            saveBeneficiary: false
        }, (txn, sender) => {
            Receipt.show(txn, sender, 'Payment Successful');
            Navigation.show('receipt');
            Toast.show('Payment successful!', 'success');
        }, (error) => Toast.show(error, 'error'));
    }
};

// ============================================
// Receipt (Moniepoint-style)
// ============================================

const Receipt = {
    current: null,
    currentText: '',

    show(txn, senderUser, title) {
        const now = txn.timestamp || new Date().toISOString();
        const receiptNo = txn.receiptNo || Api.sync('generateReceiptNo', []);
        const reference = txn.reference || Api.sync('generateReference', []);
        const recipientName = txn.recipientName || (txn.type === 'credit' ? (txn.senderName || 'Unknown') : 'Unknown');
        const recipientAccount = txn.recipientAccount || (txn.type === 'credit' ? (txn.senderAccount || '---') : '---');
        const bankName = txn.bankName || 'Goldltm Wallet';
        const senderName = txn.type === 'credit' ? 'Goldltm' : (txn.senderName || (senderUser && senderUser.fullName) || 'You');
        const senderAccount = txn.type === 'credit' ? (txn.senderAccount || 'SYSTEM') : (txn.senderAccount || (senderUser && senderUser.accountNumber) || '---');

        const isBankTransfer = !!bankName && bankName !== 'Goldltm Wallet';
        const stamp = Utils.formatDate(now) + ' ' + Utils.formatTime(now);
        this.currentData = {
            title: title || 'Transaction Details',
            status: 'Successful',
            amount: Utils.nairaPlain(txn.amount),
            fee: Utils.nairaPlain(0),
            paymentAmount: Utils.nairaPlain(txn.amount),
            txnType: txn.txnType || 'Wallet Transfer',
            recipientName: recipientName,
            recipientAccount: recipientAccount,
            bankName: bankName,
            senderName: senderName,
            senderAccount: senderAccount,
            completion: stamp,
            stepTime: stamp,
            steps: [
                'Payment successful',
                isBankTransfer ? 'Submitted to bank' : 'Processed by Goldltm',
                isBankTransfer ? 'Received by bank' : 'Received by recipient'
            ],
            sessionNo: receiptNo,
            txnId: txn.id,
            reference: reference,
            application: 'Goldltm',
            biometricVerified: !!txn.biometricVerified
        };
        this.currentText =
            'GOLDLTM\nTransaction Receipt\n' +
            'Receipt No.: ' + receiptNo + '\n' +
            'Date: ' + Utils.formatDate(now) + '\n' +
            'Time: ' + Utils.formatTime(now) + '\n' +
            'Sender: ' + senderName + '\n' +
            'Sender Account: ' + senderAccount + '\n' +
            'Recipient: ' + recipientName + '\n' +
            'Recipient Account: ' + recipientAccount + '\n' +
            'Bank: ' + bankName + '\n' +
            'Amount: ' + Utils.nairaPlain(txn.amount) + '\n' +
            'Transaction Type: ' + (txn.txnType || 'Wallet Transfer') + '\n' +
            'Status: Successful\n' +
            'Transaction ID: ' + txn.id + '\n' +
            'Reference: ' + reference + '\n\n' +
            'Thank you for using Goldltm.\nwww.goldltm.com';

        const d = this.currentData;
        const checkSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>';
        const stepNode = '<div class="receipt-step-node">' + checkSvg + '</div>';
        const timelineHtml = d.steps.map((label, i) =>
            (i > 0 ? '<div class="receipt-step-line"></div>' : '') +
            '<div class="receipt-step">' + stepNode +
            '<div class="receipt-step-label">' + Utils.esc(label) + '</div>' +
            '<div class="receipt-step-time">' + Utils.esc(d.stepTime) + '</div>' +
            '</div>').join('');
        const row = (label, value, cls) =>
            '<div class="receipt-row ' + (cls || '') + '"><span class="receipt-row-label">' + label + '</span>' +
            '<span class="receipt-row-value">' + Utils.esc(value) + '</span></div>';
        const copyIcon = '<svg class="receipt-copy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>';
        const copyRow = (label, value) =>
            '<div class="receipt-row top"><span class="receipt-row-label">' + label + '</span>' +
            '<span class="receipt-row-value receipt-copyable" data-value="' + Utils.esc(value) + '" onclick="Receipt.copyValue(this)">' +
            Utils.esc(value) + copyIcon + '</span></div>';

        const html =
            '<div class="receipt">' +
                '<div class="receipt-amount-hero">' + Utils.esc(d.amount) + '</div>' +
                '<div class="receipt-chip"><span class="receipt-chip-icon">' + checkSvg + '</span>' + Utils.esc(d.status) + '</div>' +
                '<div class="receipt-timeline">' + timelineHtml + '</div>' +
                '<div class="receipt-note">The transfer has been successfully paid and submitted to the recipient' +
                    (isBankTransfer ? ' bank. Kindly note the actual credited time is subject to the bank.' : '.') + '</div>' +
                '<div class="receipt-card">' +
                    row('Transfer Amount', d.amount) +
                    row('Fee', d.fee) +
                    row('Payment Amount', d.paymentAmount, 'strong') +
                '</div>' +
                '<div class="receipt-card">' +
                    '<div class="receipt-recipient"><span class="receipt-row-label">Recipient</span>' +
                    '<div class="receipt-recipient-body">' +
                    '<div class="receipt-recipient-name">' + Utils.esc(recipientName) + '</div>' +
                    '<div class="receipt-recipient-meta">' + Utils.esc(bankName) + ' | ' + Utils.esc(recipientAccount) + '</div>' +
                    '</div></div>' +
                    copyRow('Session ID', d.sessionNo) +
                '</div>' +
                '<div class="receipt-note">If the recipient account is not credited within 5 minutes, please use the Session ID to contact the recipient bank.</div>' +
                '<div class="receipt-card">' +
                    row('Completion Time', d.completion) +
                    copyRow('Transaction ID', d.txnId) +
                    row('Reference', d.reference) +
                    row('Application', d.application) +
                    row('Payment Type', d.txnType) +
                    (d.biometricVerified ? row('Biometric', 'Verified \u2713') : '') +
                    row('From', d.senderName + ' (' + d.senderAccount + ')') +
                '</div>' +
                '<div class="receipt-foot">' +
                    '<div class="receipt-foot-text">Thank you for using Goldltm</div>' +
                    '<div class="receipt-foot-web">www.goldltm.com</div>' +
                '</div>' +
            '</div>';

        document.getElementById('receipt-container').innerHTML = html;
        this.current = txn;
    },

    openFromHistory(txnId) {
        Store.load().then(() => {
            const user = Store.currentUser();
            if (!user) return;
            const txn = (user.transactions || []).find(t => t.id === txnId);
            if (!txn) {
                Toast.show('Transaction not found', 'error');
                return;
            }
            this.show(txn, user, 'Transaction Receipt');
            Navigation.show('receipt');
        }).catch(() => Toast.show('Failed to load transaction', 'error'));
    },

    share() {
        if (!this.currentData) {
            Toast.show('No receipt to share', 'error');
            return;
        }
        const b64 = this.exportCanvas().toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
        if (!b64) { Toast.show('Could not render receipt image', 'error'); return; }
        Api.call('shareReceiptImage', [b64], (channel) => {
            if (channel === 'image_error') Toast.show('Could not share receipt image', 'error');
        });
    },

    download() {
        if (!this.currentData) {
            Toast.show('No receipt to download', 'error');
            return;
        }
        Toast.show('Saving image…', 'success');
        const b64 = this.exportCanvas().toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
        if (!b64) { Toast.show('Could not render receipt image', 'error'); return; }
        Api.call('saveReceiptImage', [b64], (channel, data) => {
            if (channel === 'image_saved') {
                Toast.show('Receipt saved to gallery (Goldltm folder)', 'success');
            } else {
                Toast.show((data && data.error) || 'Could not save image — use Share instead', 'error');
            }
        });
    },

    // ------------------------------------------
    // Canvas renderer — mirrors the on-screen receipt
    // so the exported PNG matches what the user sees.
    // ------------------------------------------
    exportCanvas() {
        const d = this.currentData;
        const W = 1080, PAD = 56, S = 2; // S = pixel density multiplier
        const INK = '#FFFFFF', SUB = '#B0C4D0', GOLD = '#FFDA6A',
              BG = '#001E2D', CARD = '#0F3347', GREEN = '#4CAF50';
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        const font = (size, weight) => (weight || '500') + ' ' + size + 'px -apple-system, Roboto, "Segoe UI", sans-serif';
        const elide = (text, maxPx, size, weight) => {
            ctx.font = font(size, weight);
            text = String(text || '');
            if (ctx.measureText(text).width <= maxPx) return text;
            while (text.length > 1 && ctx.measureText(text + '…').width > maxPx) text = text.slice(0, -1);
            return text + '…';
        };
        const wrapLines = (text, maxPx, size, weight) => {
            ctx.font = font(size, weight);
            const words = String(text || '').split(' ');
            const lines = [];
            let cur = '';
            words.forEach((w) => {
                const trial = cur ? cur + ' ' + w : w;
                if (ctx.measureText(trial).width <= maxPx) { cur = trial; return; }
                if (cur) lines.push(cur);
                cur = w;
            });
            if (cur) lines.push(cur);
            return lines;
        };

        // Every y increment lives inside its layout closure so a replay from
        // y = 0 reproduces the exact geometry used to size the canvas.
        const inner = W - PAD * 2;
        const cx = W / 2;
        let y = 0;
        const layout = [];
        const push = (fn) => layout.push(fn);

        // Amount hero + status chip
        push(() => {
            y += 90;
            ctx.fillStyle = INK; ctx.font = font(66, '800'); ctx.textAlign = 'center';
            ctx.fillText(elide(d.amount, inner, 66, '800'), cx, y);
            y += 56;
            // chip: green check circle + "Successful"
            ctx.font = font(30, '600');
            const labelW = ctx.measureText(d.status).width;
            const startX = cx - (labelW + 46) / 2;
            ctx.fillStyle = GREEN;
            ctx.beginPath(); ctx.arc(startX + 18, y - 10, 18, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = BG; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(startX + 10, y - 10); ctx.lineTo(startX + 16, y - 4); ctx.lineTo(startX + 27, y - 17);
            ctx.stroke();
            ctx.fillStyle = GREEN;
            ctx.fillText(d.status, startX + 46, y);
            y += 30;
            ctx.textAlign = 'left';
        });
        // Timeline: 3 checked steps with connectors
        push(() => {
            y += 46;
            const xs = [PAD + inner * 0.16, cx, W - PAD - inner * 0.16];
            ctx.strokeStyle = GREEN; ctx.lineWidth = 6; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(xs[0] + 22, y); ctx.lineTo(xs[1] - 22, y); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(xs[1] + 22, y); ctx.lineTo(xs[2] - 22, y); ctx.stroke();
            xs.forEach((x) => {
                ctx.fillStyle = GREEN;
                ctx.beginPath(); ctx.arc(x, y, 22, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = BG; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
                ctx.beginPath();
                ctx.moveTo(x - 9, y); ctx.lineTo(x - 2, y + 7); ctx.lineTo(x + 10, y - 8);
                ctx.stroke();
            });
            y += 60;
            xs.forEach((x, i) => {
                ctx.fillStyle = INK; ctx.font = font(24, '600'); ctx.textAlign = 'center';
                const lines = wrapLines(d.steps[i], inner * 0.3, 24, '600');
                lines.slice(0, 2).forEach((ln, li) => {
                    ctx.fillText(ln, x, y + li * 30);
                });
                ctx.fillStyle = SUB; ctx.font = font(20, '500');
                ctx.fillText(d.stepTime, x, y + 66);
                ctx.textAlign = 'left';
            });
            y += 90;
        });
        // Amounts card (Transfer / Fee / Payment)
        const amountRows = [['Transfer Amount', d.amount], ['Fee', d.fee], ['Payment Amount', d.paymentAmount]];
        push(() => {
            y += 24;
            const boxTop = y - 34;
            // Panel first so it never covers the row text drawn on top of it
            const boxH = 34 + 62 * amountRows.length + 30 + 20;
            ctx.fillStyle = 'rgba(255,255,255,0.05)';
            this._roundRect(ctx, PAD, boxTop, inner, boxH, 18);
            ctx.fill();
            amountRows.forEach((r, i) => {
                y += 62;
                const strong = i === amountRows.length - 1;
                ctx.fillStyle = SUB; ctx.font = font(26, '500');
                ctx.fillText(r[0], PAD + 20, y + 8);
                const labelW = ctx.measureText(r[0]).width;
                ctx.fillStyle = strong ? INK : SUB; ctx.font = font(strong ? 32 : 26, strong ? '800' : '600');
                ctx.textAlign = 'right';
                ctx.fillText(elide(r[1], inner - labelW - 80, strong ? 32 : 26, strong ? '800' : '600'), W - PAD - 20, y + 8);
                ctx.textAlign = 'left';
            });
            y = boxTop + boxH + 28;
        });
        // Recipient + Session ID card
        push(() => {
            y += 46;
            ctx.fillStyle = SUB; ctx.font = font(26, '500');
            ctx.fillText('Recipient', PAD + 20, y);
            ctx.fillStyle = INK; ctx.font = font(30, '700'); ctx.textAlign = 'right';
            ctx.fillText(elide(d.recipientName, inner * 0.68, 30, '700'), W - PAD - 20, y);
            ctx.fillStyle = SUB; ctx.font = font(24, '500');
            ctx.fillText(elide(d.bankName + ' | ' + d.recipientAccount, inner * 0.68, 24, '500'), W - PAD - 20, y + 36);
            ctx.textAlign = 'left';
            y += 84;
            ctx.fillStyle = SUB; ctx.font = font(26, '500');
            ctx.fillText('Session ID', PAD + 20, y);
            ctx.fillStyle = INK; ctx.font = font(26, '600'); ctx.textAlign = 'right';
            ctx.fillText(elide(d.sessionNo, inner * 0.6, 26, '600'), W - PAD - 20, y);
            ctx.textAlign = 'left';
            y += 40;
        });
        // Details card
        const detailRows = [
            ['Completion Time', d.completion], ['Transaction ID', d.txnId],
            ['Reference', d.reference], ['Application', d.application],
            ['Payment Type', d.txnType], ['From', d.senderName + ' (' + d.senderAccount + ')']
        ];
        push(() => {
            detailRows.forEach((r) => {
                y += 62;
                ctx.fillStyle = SUB; ctx.font = font(26, '500');
                ctx.fillText(r[0], PAD + 20, y + 8);
                const labelW = ctx.measureText(r[0]).width;
                ctx.fillStyle = INK; ctx.font = font(26, '600'); ctx.textAlign = 'right';
                ctx.fillText(elide(r[1], inner - labelW - 80, 26, '600'), W - PAD - 20, y + 8);
                ctx.textAlign = 'left';
            });
            y += 30;
        });
        // Footer
        push(() => {
            y += 30;
            ctx.textAlign = 'center';
            ctx.fillStyle = SUB; ctx.font = font(24, '500');
            ctx.fillText('Thank you for using Goldltm', cx, y);
            y += 36;
            ctx.fillStyle = GOLD; ctx.font = font(22, '600');
            ctx.fillText('www.goldltm.com', cx, y);
            y += 12;
            ctx.textAlign = 'left';
        });

        // Pass 1: replay to measure total height
        layout.forEach((fn) => fn());
        const totalH = y + 40;
        // Resize clears the scratch drawing; scale to device density and replay
        canvas.width = W * S;
        canvas.height = Math.ceil(totalH) * S;
        ctx.scale(S, S);
        ctx.fillStyle = BG;
        ctx.fillRect(0, 0, W, totalH);
        ctx.fillStyle = CARD;
        this._roundRect(ctx, 24, 24, W - 48, totalH - 48, 28);
        ctx.fill();
        y = 0;
        layout.forEach((fn) => fn());
        return canvas;
    },

    copyValue(el) {
        const text = (el && el.getAttribute && el.getAttribute('data-value')) || '';
        let ok = false;
        try {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.setAttribute('readonly', '');
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            ok = document.execCommand('copy');
            document.body.removeChild(ta);
        } catch (e) { ok = false; }
        Toast.show(ok ? 'Copied to clipboard' : 'Could not copy', ok ? 'success' : 'error');
    },

    _roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }
};

// ============================================
// App init
// ============================================

const App = {
    init() {
        // Apply saved theme
        const theme = Session.get('theme_preference', 'dark');
        if (theme === 'light') {
            document.documentElement.setAttribute('data-theme', 'light');
        } else {
            document.documentElement.removeAttribute('data-theme');
        }

        PinEntry.init();

        // Wire screen-specific loads into navigation
        const origShow = Navigation.show.bind(Navigation);
        Navigation.show = function (name, replace) {
            origShow(name, replace);
            if (name === 'settings') Settings.load();
            if (name === 'security') Security.load();
            if (name === 'login') Auth.refreshBiometric();
        };

        // Live summary update
        const amountInput = document.getElementById('send-amount');
        const narrationInput = document.getElementById('send-narration');
        if (amountInput) amountInput.addEventListener('input', () => SendMoney.updateSummary());
        if (narrationInput) narrationInput.addEventListener('input', () => SendMoney.updateSummary());

        // Splash -> session routing (biometric-gated when enabled — spec 2.1)
        setTimeout(() => {
            const bio = Biometric.refresh();
            const bioGated = bio.loginEnabled && bio.available && !!Session.accountNumber;
            if (bioGated) {
                // Entry requires biometrics; PIN form stays available as fallback
                Navigation.show('login');
                Auth.refreshBiometric();
                setTimeout(() => Biometric.login(), 500);
            } else if (Session.isLoggedIn && Session.accountNumber) {
                BottomNav.go('home');
            } else if (Session.get('onboarding_complete') !== 'true') {
                Onboarding.open();
            } else {
                Navigation.show('login');
                Auth.refreshBiometric();
            }
        }, 2200);
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());

