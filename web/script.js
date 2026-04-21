// Tab switching
function switchTab(tab) {
  document.getElementById('form-login').classList.toggle('hidden', tab !== 'login');
  document.getElementById('form-register').classList.toggle('hidden', tab !== 'register');
  document.getElementById('tab-login').classList.toggle('active', tab === 'login');
  document.getElementById('tab-register').classList.toggle('active', tab === 'register');
}

// Show/hide password
function togglePassword(inputId, btn) {
  const input = document.getElementById(inputId);
  const isText = input.type === 'text';
  input.type = isText ? 'password' : 'text';
  btn.style.opacity = isText ? '1' : '0.5';
}

function setError(id, msg) {
  document.getElementById(id).textContent = msg;
}

function clearErrors(...ids) {
  ids.forEach(id => document.getElementById(id).textContent = '');
}

function showStatus(id, msg, type) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.className = `status-msg show ${type}`;
}

// Password strength
document.getElementById('reg-password').addEventListener('input', function () {
  const val = this.value;
  const fill = document.getElementById('strength-fill');
  let score = 0;
  if (val.length >= 6) score++;
  if (val.length >= 10) score++;
  if (/[A-Z]/.test(val)) score++;
  if (/[0-9]/.test(val)) score++;
  if (/[^A-Za-z0-9]/.test(val)) score++;

  const pct = (score / 5) * 100;
  fill.style.width = pct + '%';
  fill.style.background = score <= 1 ? '#f87171' : score <= 3 ? '#facc15' : '#22c55e';
});

// LocalStorage helpers
function getAccounts() {
  return JSON.parse(localStorage.getItem('cc_accounts') || '[]');
}

function saveAccount(name, email, password) {
  const accounts = getAccounts();
  accounts.push({ name, email, password });
  localStorage.setItem('cc_accounts', JSON.stringify(accounts));
}

// Login
document.getElementById('login-form').addEventListener('submit', function (e) {
  e.preventDefault();
  clearErrors('login-email-err', 'login-pass-err');

  const email = document.getElementById('login-email').value.trim().toLowerCase();
  const password = document.getElementById('login-password').value;
  let valid = true;

  if (!email) { setError('login-email-err', 'Vui lòng nhập email.'); valid = false; }
  if (!password) { setError('login-pass-err', 'Vui lòng nhập mật khẩu.'); valid = false; }
  if (!valid) return;

  const accounts = getAccounts();
  const found = accounts.find(a => a.email === email && a.password === password);

  if (found) {
    showStatus('login-status', `Đăng nhập thành công! Chào mừng, ${found.name}.`, 'success');
  } else {
    showStatus('login-status', 'Email hoặc mật khẩu không đúng.', 'error');
  }
});

// Register
document.getElementById('register-form').addEventListener('submit', function (e) {
  e.preventDefault();
  clearErrors('reg-name-err', 'reg-email-err', 'reg-pass-err', 'reg-confirm-err', 'reg-terms-err');

  const name     = document.getElementById('reg-name').value.trim();
  const email    = document.getElementById('reg-email').value.trim().toLowerCase();
  const password = document.getElementById('reg-password').value;
  const confirm  = document.getElementById('reg-confirm').value;
  const terms    = document.getElementById('terms').checked;
  let valid = true;

  if (!name)                        { setError('reg-name-err', 'Vui lòng nhập họ tên.'); valid = false; }
  if (!email)                       { setError('reg-email-err', 'Vui lòng nhập email.'); valid = false; }
  else if (!/\S+@\S+\.\S+/.test(email)) { setError('reg-email-err', 'Email không hợp lệ.'); valid = false; }
  if (password.length < 6)          { setError('reg-pass-err', 'Mật khẩu tối thiểu 6 ký tự.'); valid = false; }
  if (password !== confirm)         { setError('reg-confirm-err', 'Mật khẩu xác nhận không khớp.'); valid = false; }
  if (!terms)                       { setError('reg-terms-err', 'Bạn cần đồng ý điều khoản.'); valid = false; }
  if (!valid) return;

  const accounts = getAccounts();
  if (accounts.find(a => a.email === email)) {
    setError('reg-email-err', 'Email này đã được đăng ký.');
    return;
  }

  saveAccount(name, email, password);
  showStatus('register-status', 'Tạo tài khoản thành công! Bạn có thể đăng nhập ngay.', 'success');
  setTimeout(() => switchTab('login'), 1800);
});
