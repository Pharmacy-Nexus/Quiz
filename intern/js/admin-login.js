(function () {
  'use strict';

  function renderLoginPage() {
    const root = InternCore.qs('#internPageRoot');

    root.innerHTML = `
      <section class="card" style="max-width:720px; margin:40px auto;">
        <div class="section-header">
          <div>
            <h2>Intern Admin Login</h2>
            <p>Sign in with your admin email and password.</p>
          </div>
        </div>

        <div class="input-row two">
          <div>
            <label class="muted">Email</label>
            <input class="input" id="adminLoginEmail" type="email" placeholder="admin@email.com" />
          </div>
          <div>
            <label class="muted">Password</label>
            <input class="input" id="adminLoginPassword" type="password" placeholder="Enter password" />
          </div>
        </div>

        <div id="adminLoginMessage" style="margin-top:16px;"></div>

        <div class="action-row" style="justify-content:flex-start; margin-top:20px;">
          <button class="btn btn-primary" id="adminLoginBtn" type="button">Sign In</button>
          <a class="btn btn-light" href="../index.html">Back</a>
        </div>
      </section>
    `;
  }

  async function handleLogin() {
    const email = InternCore.qs('#adminLoginEmail').value.trim();
    const password = InternCore.qs('#adminLoginPassword').value;
    const msg = InternCore.qs('#adminLoginMessage');

    if (!email || !password) {
      msg.innerHTML = `<div class="message error">Email and password are required.</div>`;
      return;
    }

    try {
      const { data, error } = await InternSupabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      const userEmail = data?.user?.email?.toLowerCase() || '';
      const allowedEmail = InternCore.config.allowedAdminEmail.toLowerCase();

      if (userEmail !== allowedEmail) {
        await InternSupabase.auth.signOut();
        msg.innerHTML = `<div class="message error">This account is not allowed to access admin.</div>`;
        return;
      }

      window.location.href = './admin.html';
    } catch (error) {
      console.error(error);
      msg.innerHTML = `<div class="message error">Login failed. Check your email and password.</div>`;
    }
  }

  async function initAdminLoginPage() {
    InternCore.createShell();

    try {
      const { data, error } = await InternSupabase.auth.getUser();

      if (!error && data?.user) {
        const userEmail = data.user.email?.toLowerCase() || '';
        const allowedEmail = InternCore.config.allowedAdminEmail.toLowerCase();

        if (userEmail === allowedEmail) {
          window.location.href = './admin.html';
          return;
        } else {
          await InternSupabase.auth.signOut();
        }
      }
    } catch (_) {}

    renderLoginPage();

    InternCore.qs('#adminLoginBtn')?.addEventListener('click', handleLogin);
    InternCore.qs('#adminLoginPassword')?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') handleLogin();
    });
  }

  document.addEventListener('DOMContentLoaded', initAdminLoginPage);
})();
