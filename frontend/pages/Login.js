const LoginPage = {
  data() {
    return {
      viewMode: 'login',
      emailField: '',
      passwordField: '',
      nameField: '',
      phoneField: '',
      confirmPasswordField: '',
      errorMsg: '',
      successMsg: '',
      isSubmitting: false
    };
  },
  methods: {
    switchToSignup() {
      this.viewMode = 'signup';
      this.errorMsg = '';
      this.successMsg = '';
    },
    switchToLogin() {
      this.viewMode = 'login';
      this.errorMsg = '';
      this.successMsg = '';
    },
    async submitLogin() {
      this.errorMsg = '';
      if (!this.emailField.trim() || !this.passwordField.trim()) {
        this.errorMsg = 'Please enter both email and password';
        return;
      }
      this.isSubmitting = true;
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email_addr: this.emailField.trim(),
            password: this.passwordField
          })
        });
        const payload = await res.json();
        if (!res.ok) {
          this.errorMsg = payload.error || 'Login failed';
          this.isSubmitting = false;
          return;
        }
        this.$emit('login-success', payload);
      } catch (err) {
        this.errorMsg = 'Could not reach the server';
        this.isSubmitting = false;
      }
    },
    async submitSignup() {
      this.errorMsg = '';
      this.successMsg = '';
      if (!this.nameField.trim() || !this.emailField.trim() || !this.passwordField.trim()) {
        this.errorMsg = 'Name, email and password are required';
        return;
      }
      if (this.passwordField !== this.confirmPasswordField) {
        this.errorMsg = 'Passwords do not match';
        return;
      }
      this.isSubmitting = true;
      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            full_name: this.nameField.trim(),
            email_addr: this.emailField.trim(),
            password: this.passwordField,
            phone_no: this.phoneField.trim()
          })
        });
        const payload = await res.json();
        this.isSubmitting = false;
        if (!res.ok) {
          this.errorMsg = payload.error || 'Registration failed';
          return;
        }
        this.successMsg = 'Account created! You can log in now';
        this.viewMode = 'login';
        this.passwordField = '';
        this.confirmPasswordField = '';
      } catch (err) {
        this.errorMsg = 'Could not reach the server';
        this.isSubmitting = false;
      }
    }
  },
  template: `
    <div>
      <div class="st-nav">
        <a class="st-brand" href="#">
          <i class="ti ti-mountain"></i> SummitTrails
        </a>
      </div>

      <div class="st-hero">
        <h1>Welcome to SummitTrails</h1>
        <p>Plan, book and track your next trek with us</p>
      </div>

      <div class="d-flex justify-content-center" style="padding: 40px 16px;">
        <div class="st-card" style="max-width: 420px; width: 100%; padding: 32px;">

          <div v-if="errorMsg" class="alert-st alert-danger">{{ errorMsg }}</div>
          <div v-if="successMsg" class="alert-st alert-success">{{ successMsg }}</div>

          <template v-if="viewMode === 'login'">
            <h5 style="font-size: 19px; font-weight: 600; color: #0C447C; margin-bottom: 20px;">Log in to your account</h5>

            <label class="form-label-st">Email</label>
            <input class="form-input-st" type="email" v-model="emailField" placeholder="you@example.com" @keyup.enter="submitLogin" />

            <label class="form-label-st">Password</label>
            <input class="form-input-st" type="password" v-model="passwordField" placeholder="••••••••" @keyup.enter="submitLogin" />

            <button class="btn-primary-st" :disabled="isSubmitting" @click="submitLogin">
              {{ isSubmitting ? 'Logging in...' : 'Log In' }}
            </button>

            <p style="text-align: center; font-size: 13px; color: #6c757d; margin-top: 18px;">
              New trekker?
              <a href="#" @click.prevent="switchToSignup" style="color: #185FA5; font-weight: 500;">Create an account</a>
            </p>
          </template>

          <template v-else>
            <h5 style="font-size: 19px; font-weight: 600; color: #0C447C; margin-bottom: 20px;">Create your trekker account</h5>

            <label class="form-label-st">Full Name</label>
            <input class="form-input-st" type="text" v-model="nameField" placeholder="Jane Doe" />

            <label class="form-label-st">Email</label>
            <input class="form-input-st" type="email" v-model="emailField" placeholder="you@example.com" />

            <label class="form-label-st">Phone Number</label>
            <input class="form-input-st" type="text" v-model="phoneField" placeholder="9876543210" />

            <label class="form-label-st">Password</label>
            <input class="form-input-st" type="password" v-model="passwordField" placeholder="••••••••" />

            <label class="form-label-st">Confirm Password</label>
            <input class="form-input-st" type="password" v-model="confirmPasswordField" placeholder="••••••••" />

            <button class="btn-primary-st" :disabled="isSubmitting" @click="submitSignup">
              {{ isSubmitting ? 'Creating account...' : 'Sign Up' }}
            </button>

            <p style="text-align: center; font-size: 13px; color: #6c757d; margin-top: 18px;">
              Already have an account?
              <a href="#" @click.prevent="switchToLogin" style="color: #185FA5; font-weight: 500;">Log in</a>
            </p>
          </template>

        </div>
      </div>
    </div>
  `
};