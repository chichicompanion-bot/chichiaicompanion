const loginForm = document.getElementById("login-form");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const rememberInput = document.getElementById("remember");
const formStatus = document.getElementById("form-status");
const fillDemoButton = document.getElementById("fill-demo");
// Đã xóa code cũ, chuẩn bị cho code mới
const DEMO_ACCOUNT = {
  email: "demo@studybot.vn",
  password: "123456",
};

function setStatus(message, type = "") {
  formStatus.textContent = message;
  formStatus.className = "form-status";

  if (type) {
    formStatus.classList.add(`is-${type}`);
  }
}

fillDemoButton.addEventListener("click", () => {
  emailInput.value = DEMO_ACCOUNT.email;
  passwordInput.value = DEMO_ACCOUNT.password;
  rememberInput.checked = true;
  setStatus("Da dien san tai khoan demo. Ban co the bam Dang nhap de test.", "success");
});

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const email = emailInput.value.trim().toLowerCase();
  const password = passwordInput.value;

  if (!email || !password) {
    setStatus("Hay nhap day du email va mat khau.", "error");
    return;
  }

  if (email === DEMO_ACCOUNT.email && password === DEMO_ACCOUNT.password) {
    setStatus(
      rememberInput.checked
        ? "Dang nhap demo thanh cong. He thong se co the ghi nho phien cua ban sau nay."
        : "Dang nhap demo thanh cong. San sang de noi backend that.",
      "success"
    );
    return;
  }

  setStatus("Thong tin dang nhap chua dung. Thu tai khoan demo de test giao dien.", "error");
});
