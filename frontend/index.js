const summitAuthStore = Vue.reactive({
  token: localStorage.getItem('summitTrailsToken') || null,
  uid: localStorage.getItem('summitTrailsUid') || null,
  role: localStorage.getItem('summitTrailsRole') || null,
  fullName: localStorage.getItem('summitTrailsName') || null
});

window.summitAuthStore = summitAuthStore;

function persistSummitSession(loginResponse) {
  localStorage.setItem('summitTrailsToken', loginResponse.token);
  localStorage.setItem('summitTrailsUid', loginResponse.uid);
  localStorage.setItem('summitTrailsRole', loginResponse.role);
  localStorage.setItem('summitTrailsName', loginResponse.full_name);
  summitAuthStore.token = loginResponse.token;
  summitAuthStore.uid = loginResponse.uid;
  summitAuthStore.role = loginResponse.role;
  summitAuthStore.fullName = loginResponse.full_name;
}

function clearSummitSession() {
  localStorage.removeItem('summitTrailsToken');
  localStorage.removeItem('summitTrailsUid');
  localStorage.removeItem('summitTrailsRole');
  localStorage.removeItem('summitTrailsName');
  summitAuthStore.token = null;
  summitAuthStore.uid = null;
  summitAuthStore.role = null;
  summitAuthStore.fullName = null;
}

function mapRoleToPage(role) {
  if (role === 'admin') return 'admin';
  if (role === 'staff') return 'staff';
  if (role === 'trekker') return 'user';
  return 'login';
}

const rootAppConfig = {
  data() {
    return {
      currentPage: 'login'
    };
  },
  created() {
    if (summitAuthStore.token && summitAuthStore.role) {
      this.currentPage = mapRoleToPage(summitAuthStore.role);
    }
  },
  methods: {
    handleLogin(loginResponse) {
      persistSummitSession(loginResponse);
      this.currentPage = mapRoleToPage(loginResponse.role);
    },
    handleLogout() {
      clearSummitSession();
      this.currentPage = 'login';
    }
  }
};

const summitApp = Vue.createApp(rootAppConfig);

summitApp.component('login-page', LoginPage);
summitApp.component('admin-dash', AdminDash);
summitApp.component('staff-dash', StaffDash);
summitApp.component('user-dash', UserDash);

summitApp.mount('#app');