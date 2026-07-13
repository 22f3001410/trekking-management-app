const AdminDash = {
  data() {
    return {
      activeTab: 'overview',
      statsData: null,
      treksList: [],
      staffMembers: [],
      trekkerUsers: [],
      bookingsData: [],
      summaryReport: [],
      trekSearchQuery: '',
      staffSearchQuery: '',
      userSearchQuery: '',
      showTrekModal: false,
      editingTrekId: null,
      trekForm: {
        trek_name: '', location: '', difficulty: 'Easy', duration_days: '',
        total_slots: '', start_date: '', end_date: '', altitude_meters: '', meeting_point: '', status: 'Pending'
      },
      showStaffModal: false,
      staffForm: { full_name: '', email_addr: '', password: '', phone_no: '', expertise_level: '' },
      showAssignModal: false,
      assignForm: { staff_id: '', trek_id: '' },
      bannerMsg: '',
      bannerType: 'success'
    };
  },
  created() {
    this.loadOverview();
  },
  methods: {
    authHeaders() {
      return {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + summitAuthStore.token
      };
    },
    flashBanner(msg, type) {
      this.bannerMsg = msg;
      this.bannerType = type || 'success';
      setTimeout(() => { this.bannerMsg = ''; }, 3500);
    },
    switchTab(tabName) {
      this.activeTab = tabName;
      if (tabName === 'overview') this.loadOverview();
      if (tabName === 'treks') this.loadTreks();
      if (tabName === 'staff') { this.loadStaff(); this.loadTreks(); }
      if (tabName === 'users') this.loadUsers();
      if (tabName === 'bookings') this.loadBookings();
      if (tabName === 'reports') this.loadReport();
    },
    async loadOverview() {
      const res = await fetch('/api/admin/dashboard', { headers: this.authHeaders() });
      this.statsData = await res.json();
    },
    async loadTreks() {
      const res = await fetch('/api/admin/treks?q=' + encodeURIComponent(this.trekSearchQuery), { headers: this.authHeaders() });
      this.treksList = await res.json();
    },
    async loadStaff() {
      const res = await fetch('/api/admin/staff?q=' + encodeURIComponent(this.staffSearchQuery), { headers: this.authHeaders() });
      this.staffMembers = await res.json();
    },
    async loadUsers() {
      const res = await fetch('/api/admin/users?q=' + encodeURIComponent(this.userSearchQuery), { headers: this.authHeaders() });
      this.trekkerUsers = await res.json();
    },
    async loadBookings() {
      const res = await fetch('/api/admin/bookings', { headers: this.authHeaders() });
      this.bookingsData = await res.json();
    },
    async loadReport() {
      const res = await fetch('/api/admin/reports/summary', { headers: this.authHeaders() });
      this.summaryReport = await res.json();
    },
    openAddTrekModal() {
      this.editingTrekId = null;
      this.trekForm = { trek_name: '', location: '', difficulty: 'Easy', duration_days: '', total_slots: '', start_date: '', end_date: '', altitude_meters: '', meeting_point: '', status: 'Pending' };
      this.showTrekModal = true;
    },
    openEditTrekModal(trek) {
      this.editingTrekId = trek.trek_id;
      this.trekForm = {
        trek_name: trek.trek_name, location: trek.location, difficulty: trek.difficulty,
        duration_days: trek.duration_days, total_slots: trek.total_slots,
        start_date: trek.start_date, end_date: trek.end_date,
        altitude_meters: trek.altitude_meters || '', meeting_point: trek.meeting_point || '',
        status: trek.status
      };
      this.showTrekModal = true;
    },
    async saveTrek() {
      const isEdit = this.editingTrekId !== null;
      const url = isEdit ? '/api/admin/treks/' + this.editingTrekId : '/api/admin/treks';
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: this.authHeaders(),
        body: JSON.stringify(this.trekForm)
      });
      const payload = await res.json();
      if (!res.ok) {
        this.flashBanner(payload.error || 'Could not save trek', 'danger');
        return;
      }
      this.showTrekModal = false;
      this.flashBanner(isEdit ? 'Trek updated' : 'Trek created', 'success');
      this.loadTreks();
    },
    async deleteTrek(trekId) {
      if (!confirm('Remove this trek permanently?')) return;
      const res = await fetch('/api/admin/treks/' + trekId, { method: 'DELETE', headers: this.authHeaders() });
      const payload = await res.json();
      if (!res.ok) {
        this.flashBanner(payload.error || 'Could not delete trek', 'danger');
        return;
      }
      this.flashBanner('Trek removed', 'success');
      this.loadTreks();
    },
    openAddStaffModal() {
      this.staffForm = { full_name: '', email_addr: '', password: '', phone_no: '', expertise_level: '' };
      this.showStaffModal = true;
    },
    async saveStaff() {
      const res = await fetch('/api/admin/staff', {
        method: 'POST',
        headers: this.authHeaders(),
        body: JSON.stringify(this.staffForm)
      });
      const payload = await res.json();
      if (!res.ok) {
        this.flashBanner(payload.error || 'Could not add staff', 'danger');
        return;
      }
      this.showStaffModal = false;
      this.flashBanner('Staff member added', 'success');
      this.loadStaff();
    },
    openAssignModal() {
      this.assignForm = { staff_id: '', trek_id: '' };
      this.showAssignModal = true;
      if (this.treksList.length === 0) this.loadTreks();
      if (this.staffMembers.length === 0) this.loadStaff();
    },
    async confirmAssignment() {
      if (!this.assignForm.staff_id || !this.assignForm.trek_id) {
        this.flashBanner('Pick both a staff member and a trek', 'danger');
        return;
      }
      const res = await fetch('/api/admin/staff/' + this.assignForm.staff_id + '/assign/' + this.assignForm.trek_id, {
        method: 'POST',
        headers: this.authHeaders()
      });
      const payload = await res.json();
      if (!res.ok) {
        this.flashBanner(payload.error || 'Assignment failed', 'danger');
        return;
      }
      this.showAssignModal = false;
      this.flashBanner('Staff assigned to trek', 'success');
      this.loadTreks();
      this.loadStaff();
    },
    async toggleUser(uid, action) {
      const res = await fetch('/api/admin/users/' + uid + '/toggle-status', {
        method: 'PUT',
        headers: this.authHeaders(),
        body: JSON.stringify({ action: action })
      });
      const payload = await res.json();
      if (!res.ok) {
        this.flashBanner(payload.error || 'Could not update user', 'danger');
        return;
      }
      this.flashBanner(payload.message, 'success');
      if (this.activeTab === 'staff') this.loadStaff();
      else this.loadUsers();
    },
    doLogout() {
      this.$emit('logout');
    }
  },
  template: `
    <div>
      <div class="sidebar">
        <a @click="switchTab('overview')" :class="{active: activeTab === 'overview'}"><i class="ti ti-layout-dashboard"></i> Overview</a>
        <a @click="switchTab('treks')" :class="{active: activeTab === 'treks'}"><i class="ti ti-mountain"></i> Treks</a>
        <a @click="switchTab('staff')" :class="{active: activeTab === 'staff'}"><i class="ti ti-users"></i> Staff</a>
        <a @click="switchTab('users')" :class="{active: activeTab === 'users'}"><i class="ti ti-user"></i> Trekkers</a>
        <a @click="switchTab('bookings')" :class="{active: activeTab === 'bookings'}"><i class="ti ti-ticket"></i> Bookings</a>
        <a @click="switchTab('reports')" :class="{active: activeTab === 'reports'}"><i class="ti ti-chart-bar"></i> Reports</a>
        <a @click="doLogout"><i class="ti ti-logout"></i> Logout</a>
      </div>

      <div class="main-with-sidebar" style="padding: 24px 32px;">
        <div v-if="bannerMsg" :class="['alert-st', bannerType === 'danger' ? 'alert-danger' : 'alert-success']">{{ bannerMsg }}</div>

        <div v-if="activeTab === 'overview' && statsData">
          <div class="section-title">Dashboard Overview</div>
          <div class="row g-3">
            <div class="col-md-2 col-6"><div class="stat-box"><div class="num">{{ statsData.total_treks }}</div><div class="lbl">Total Treks</div></div></div>
            <div class="col-md-2 col-6"><div class="stat-box"><div class="num">{{ statsData.active_treks }}</div><div class="lbl">Open Treks</div></div></div>
            <div class="col-md-2 col-6"><div class="stat-box"><div class="num">{{ statsData.total_users }}</div><div class="lbl">Trekkers</div></div></div>
            <div class="col-md-2 col-6"><div class="stat-box"><div class="num">{{ statsData.total_staff }}</div><div class="lbl">Staff</div></div></div>
            <div class="col-md-2 col-6"><div class="stat-box"><div class="num">{{ statsData.total_bookings }}</div><div class="lbl">Bookings</div></div></div>
          </div>
        </div>

        <div v-if="activeTab === 'treks'">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <div class="section-title mb-0">Manage Treks</div>
            <div class="d-flex gap-2">
              <input class="form-input-st" style="margin-bottom:0; width:220px;" placeholder="Search treks" v-model="trekSearchQuery" @keyup.enter="loadTreks" />
              <button class="btn-primary-st" style="width:auto;" @click="openAddTrekModal">+ New Trek</button>
            </div>
          </div>
          <table class="table-st">
            <thead><tr><th>Name</th><th>Location</th><th>Difficulty</th><th>Slots</th><th>Status</th><th>Dates</th><th></th></tr></thead>
            <tbody>
              <tr v-for="t in treksList" :key="t.trek_id">
                <td>{{ t.trek_name }}</td>
                <td>{{ t.location }}</td>
                <td><span :class="['badge-difficulty', 'badge-' + t.difficulty]" style="position:static;">{{ t.difficulty }}</span></td>
                <td>{{ t.available_slots }} / {{ t.total_slots }}</td>
                <td>{{ t.status }}</td>
                <td>{{ t.start_date }} → {{ t.end_date }}</td>
                <td>
                  <button class="btn-outline-st" style="width:auto; margin-right:6px;" @click="openEditTrekModal(t)">Edit</button>
                  <button class="btn-outline-st" style="width:auto; color:#A32D2D; border-color:#A32D2D;" @click="deleteTrek(t.trek_id)">Delete</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="activeTab === 'staff'">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <div class="section-title mb-0">Manage Staff</div>
            <div class="d-flex gap-2">
              <input class="form-input-st" style="margin-bottom:0; width:220px;" placeholder="Search staff" v-model="staffSearchQuery" @keyup.enter="loadStaff" />
              <button class="btn-outline-st" style="width:auto;" @click="openAssignModal">Assign to Trek</button>
              <button class="btn-primary-st" style="width:auto;" @click="openAddStaffModal">+ Add Staff</button>
            </div>
          </div>
          <table class="table-st">
            <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Expertise</th><th>Assigned Treks</th><th>Status</th><th></th></tr></thead>
            <tbody>
              <tr v-for="s in staffMembers" :key="s.staff_id">
                <td>{{ s.full_name }}</td>
                <td>{{ s.email_addr }}</td>
                <td>{{ s.phone_no }}</td>
                <td>{{ s.expertise_level }}</td>
                <td>
                  <span v-for="t in treksList.filter(tr => tr.assigned_staff_ids && tr.assigned_staff_ids.includes(s.staff_id))" :key="t.trek_id" style="display:inline-block; background:#E6F1FB; color:#0C447C; border-radius:6px; padding:2px 8px; font-size:12px; margin-right:4px;">{{ t.trek_name }}</span>
                  <span v-if="!treksList.some(tr => tr.assigned_staff_ids && tr.assigned_staff_ids.includes(s.staff_id))" style="color:#6c757d; font-size:12px;">None</span>
                </td>
                <td>{{ s.is_blacklisted ? 'Blacklisted' : (s.is_active ? 'Active' : 'Inactive') }}</td>
                <td>
                  <button v-if="s.is_active" class="btn-outline-st" style="width:auto; margin-right:6px;" @click="toggleUser(s.user_id, 'deactivate')">Deactivate</button>
                  <button v-else class="btn-outline-st" style="width:auto; margin-right:6px;" @click="toggleUser(s.user_id, 'activate')">Activate</button>
                  <button v-if="!s.is_blacklisted" class="btn-outline-st" style="width:auto; color:#A32D2D; border-color:#A32D2D;" @click="toggleUser(s.user_id, 'blacklist')">Blacklist</button>
                  <button v-else class="btn-outline-st" style="width:auto;" @click="toggleUser(s.user_id, 'unblacklist')">Unblacklist</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="activeTab === 'users'">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <div class="section-title mb-0">Manage Trekkers</div>
            <input class="form-input-st" style="margin-bottom:0; width:220px;" placeholder="Search trekkers" v-model="userSearchQuery" @keyup.enter="loadUsers" />
          </div>
          <table class="table-st">
            <thead><tr><th>Name</th><th>Email</th><th>Joined</th><th>Status</th><th></th></tr></thead>
            <tbody>
              <tr v-for="u in trekkerUsers" :key="u.uid">
                <td>{{ u.full_name }}</td>
                <td>{{ u.email_addr }}</td>
                <td>{{ u.joined_on }}</td>
                <td>{{ u.is_blacklisted ? 'Blacklisted' : (u.is_active ? 'Active' : 'Inactive') }}</td>
                <td>
                  <button v-if="u.is_active" class="btn-outline-st" style="width:auto; margin-right:6px;" @click="toggleUser(u.uid, 'deactivate')">Deactivate</button>
                  <button v-else class="btn-outline-st" style="width:auto; margin-right:6px;" @click="toggleUser(u.uid, 'activate')">Activate</button>
                  <button v-if="!u.is_blacklisted" class="btn-outline-st" style="width:auto; color:#A32D2D; border-color:#A32D2D;" @click="toggleUser(u.uid, 'blacklist')">Blacklist</button>
                  <button v-else class="btn-outline-st" style="width:auto;" @click="toggleUser(u.uid, 'unblacklist')">Unblacklist</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="activeTab === 'bookings'">
          <div class="section-title">All Bookings</div>
          <table class="table-st">
            <thead><tr><th>Booking ID</th><th>User</th><th>Trek</th><th>Location</th><th>Booked On</th><th>Status</th><th>Payment</th></tr></thead>
            <tbody>
              <tr v-for="b in bookingsData" :key="b.booking_id">
                <td>{{ b.booking_id }}</td>
                <td>{{ b.user_name }}</td>
                <td>{{ b.trek_name }}</td>
                <td>{{ b.location }}</td>
                <td>{{ b.booked_on }}</td>
                <td>{{ b.booking_status }}</td>
                <td>{{ b.payment_status }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="activeTab === 'reports'">
          <div class="section-title">Trek Summary Report</div>
          <table class="table-st">
            <thead><tr><th>Trek</th><th>Location</th><th>Status</th><th>Slots</th><th>Bookings</th></tr></thead>
            <tbody>
              <tr v-for="r in summaryReport" :key="r.trek_name">
                <td>{{ r.trek_name }}</td>
                <td>{{ r.location }}</td>
                <td>{{ r.status }}</td>
                <td>{{ r.available_slots }} / {{ r.total_slots }}</td>
                <td>{{ r.total_bookings }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div v-if="showTrekModal" class="modal-overlay" @click.self="showTrekModal = false">
        <div class="modal-box">
          <h5>{{ editingTrekId ? 'Edit Trek' : 'New Trek' }}</h5>
          <label class="form-label-st">Trek Name</label>
          <input class="form-input-st" v-model="trekForm.trek_name" />
          <label class="form-label-st">Location</label>
          <input class="form-input-st" v-model="trekForm.location" />
          <label class="form-label-st">Difficulty</label>
          <select class="form-input-st" v-model="trekForm.difficulty">
            <option>Easy</option><option>Moderate</option><option>Hard</option>
          </select>
          <label class="form-label-st">Duration (days)</label>
          <input class="form-input-st" type="number" v-model="trekForm.duration_days" />
          <label class="form-label-st">Total Slots</label>
          <input class="form-input-st" type="number" v-model="trekForm.total_slots" />
          <label class="form-label-st">Start Date</label>
          <input class="form-input-st" type="date" v-model="trekForm.start_date" />
          <label class="form-label-st">End Date</label>
          <input class="form-input-st" type="date" v-model="trekForm.end_date" />
          <label class="form-label-st">Meeting Point</label>
          <input class="form-input-st" v-model="trekForm.meeting_point" />
          <label class="form-label-st">Status</label>
          <select class="form-input-st" v-model="trekForm.status">
            <option>Pending</option>
            <option>Approved</option>
            <option>Open</option>
            <option>Closed</option>
            <option>Completed</option>
          </select>
          <div class="d-flex gap-2">
            <button class="btn-primary-st" @click="saveTrek">Save</button>
            <button class="btn-outline-st" @click="showTrekModal = false">Cancel</button>
          </div>
        </div>
      </div>

      <div v-if="showStaffModal" class="modal-overlay" @click.self="showStaffModal = false">
        <div class="modal-box">
          <h5>Add Staff Member</h5>
          <label class="form-label-st">Full Name</label>
          <input class="form-input-st" v-model="staffForm.full_name" />
          <label class="form-label-st">Email</label>
          <input class="form-input-st" v-model="staffForm.email_addr" />
          <label class="form-label-st">Password</label>
          <input class="form-input-st" type="password" v-model="staffForm.password" />
          <label class="form-label-st">Phone</label>
          <input class="form-input-st" v-model="staffForm.phone_no" />
          <label class="form-label-st">Expertise Level</label>
          <select class="form-input-st" v-model="staffForm.expertise_level">
            <option value="">Select expertise</option>
            <option>Beginner</option>
            <option>Intermediate</option>
            <option>Advanced</option>
            <option>Expert</option>
          </select>
          <div class="d-flex gap-2">
            <button class="btn-primary-st" @click="saveStaff">Add</button>
            <button class="btn-outline-st" @click="showStaffModal = false">Cancel</button>
          </div>
        </div>
      </div>

      <div v-if="showAssignModal" class="modal-overlay" @click.self="showAssignModal = false">
        <div class="modal-box">
          <h5>Assign Staff to Trek</h5>
          <label class="form-label-st">Staff Member</label>
          <select class="form-input-st" v-model="assignForm.staff_id">
            <option value="">Select staff</option>
            <option v-for="s in staffMembers" :key="s.staff_id" :value="s.staff_id">{{ s.full_name }}</option>
          </select>
          <label class="form-label-st">Trek</label>
          <select class="form-input-st" v-model="assignForm.trek_id">
            <option value="">Select trek</option>
            <option v-for="t in treksList" :key="t.trek_id" :value="t.trek_id">{{ t.trek_name }}</option>
          </select>
          <div class="d-flex gap-2">
            <button class="btn-primary-st" @click="confirmAssignment">Assign</button>
            <button class="btn-outline-st" @click="showAssignModal = false">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  `
};