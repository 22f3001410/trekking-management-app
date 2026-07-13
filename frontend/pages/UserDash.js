const UserDash = {
  data() {
    return {
      activeTab: 'browse',
      dashStats: null,
      browseTreks: [],
      filterDifficulty: '',
      filterLocation: '',
      filterDuration: '',
      filterSearch: '',
      myBookingsList: [],
      historyList: [],
      exportTaskId: null,
      exportState: 'idle',
      bannerMsg: '',
      bannerType: 'success',
      showProfileModal: false,
      profileForm: { full_name: '', phone_no: '', new_password: '' }
    };
  },
  created() {
    this.loadDashboard();
    this.loadBrowseTreks();
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
    switchTab(tab) {
      this.activeTab = tab;
      if (tab === 'browse') this.loadBrowseTreks();
      if (tab === 'bookings') this.loadMyBookings();
      if (tab === 'history') this.loadHistory();
    },
    async loadDashboard() {
      const res = await fetch('/api/user/dashboard', { headers: this.authHeaders() });
      this.dashStats = await res.json();
    },
    async loadBrowseTreks() {
      const params = new URLSearchParams();
      if (this.filterDifficulty) params.append('difficulty', this.filterDifficulty);
      if (this.filterLocation) params.append('location', this.filterLocation);
      if (this.filterDuration) params.append('duration', this.filterDuration);
      if (this.filterSearch) params.append('q', this.filterSearch);
      const res = await fetch('/api/user/treks?' + params.toString(), { headers: this.authHeaders() });
      this.browseTreks = await res.json();
    },
    clearFilters() {
      this.filterDifficulty = '';
      this.filterLocation = '';
      this.filterDuration = '';
      this.filterSearch = '';
      this.loadBrowseTreks();
    },
    async bookTrek(trek) {
      const res = await fetch('/api/user/bookings', {
        method: 'POST',
        headers: this.authHeaders(),
        body: JSON.stringify({ trek_id: trek.trek_id })
      });
      const payload = await res.json();
      if (!res.ok) {
        this.flashBanner(payload.error || 'Could not book trek', 'danger');
        return;
      }
      this.flashBanner('Trek booked successfully', 'success');
      this.loadBrowseTreks();
      this.loadDashboard();
    },
    async loadMyBookings() {
      const res = await fetch('/api/user/bookings', { headers: this.authHeaders() });
      this.myBookingsList = await res.json();
    },
    async cancelBooking(booking) {
      if (!confirm('Cancel this booking?')) return;
      const res = await fetch('/api/user/bookings/' + booking.booking_id + '/cancel', {
        method: 'PUT',
        headers: this.authHeaders()
      });
      const payload = await res.json();
      if (!res.ok) {
        this.flashBanner(payload.error || 'Could not cancel booking', 'danger');
        return;
      }
      this.flashBanner('Booking cancelled', 'success');
      this.loadMyBookings();
      this.loadDashboard();
    },
    async loadHistory() {
      const res = await fetch('/api/user/history', { headers: this.authHeaders() });
      this.historyList = await res.json();
    },
    async startExport() {
      this.exportState = 'pending';
      const res = await fetch('/api/user/history/export', { headers: this.authHeaders() });
      const payload = await res.json();
      if (!res.ok) {
        this.flashBanner(payload.error || 'Could not start export', 'danger');
        this.exportState = 'idle';
        return;
      }
      this.exportTaskId = payload.task_id;
      this.pollExportStatus();
    },
    async pollExportStatus() {
      const res = await fetch('/api/user/history/export/status/' + this.exportTaskId, { headers: this.authHeaders() });
      const payload = await res.json();
      if (payload.status === 'ready') {
        this.exportState = 'ready';
        this.flashBanner('Your export is ready to download', 'success');
        return;
      }
      if (payload.status === 'failed') {
        this.exportState = 'idle';
        this.flashBanner('Export failed, please try again', 'danger');
        return;
      }
      setTimeout(() => this.pollExportStatus(), 2000);
    },
    downloadExport() {
      const downloadUrl = '/api/user/history/export/download/' + this.exportTaskId + '?token=' + summitAuthStore.token;
      window.open(downloadUrl, '_blank');
      this.exportState = 'idle';
      this.exportTaskId = null;
    },
    openProfileModal() {
      this.profileForm = {
        full_name: summitAuthStore.fullName || '',
        phone_no: '',
        new_password: ''
      };
      this.showProfileModal = true;
    },
    async saveProfile() {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: this.authHeaders(),
        body: JSON.stringify(this.profileForm)
      });
      const payload = await res.json();
      if (!res.ok) {
        this.flashBanner(payload.error || 'Could not update profile', 'danger');
        return;
      }
      summitAuthStore.fullName = this.profileForm.full_name;
      localStorage.setItem('summitTrailsName', this.profileForm.full_name);
      this.showProfileModal = false;
      this.flashBanner('Profile updated', 'success');
    },
    doLogout() {
      this.$emit('logout');
    }
  },
  template: `
    <div>
      <div class="st-nav">
        <a class="st-brand" href="#"><i class="ti ti-mountain"></i> SummitTrails</a>
        <div class="st-nav-links">
          <span style="color:#fff; margin-right:16px;" v-if="dashStats">{{ dashStats.full_name }}</span>
          <a href="#" @click.prevent="switchTab('browse')">Browse Treks</a>
          <a href="#" @click.prevent="switchTab('bookings')">My Bookings</a>
          <a href="#" @click.prevent="switchTab('history')">History</a>
          <a href="#" @click.prevent="openProfileModal">Edit Profile</a>
          <a href="#" @click.prevent="doLogout">Logout</a>
        </div>
      </div>

      <div style="padding: 24px 32px;">
        <div v-if="bannerMsg" :class="['alert-st', bannerType === 'danger' ? 'alert-danger' : 'alert-success']">{{ bannerMsg }}</div>

        <div class="row g-3 mb-4" v-if="dashStats">
          <div class="col-md-4 col-6"><div class="stat-box"><div class="num">{{ dashStats.active_treks }}</div><div class="lbl">Open Treks</div></div></div>
          <div class="col-md-4 col-6"><div class="stat-box"><div class="num">{{ dashStats.my_bookings }}</div><div class="lbl">My Bookings</div></div></div>
          <div class="col-md-4 col-6"><div class="stat-box"><div class="num">{{ dashStats.completed_treks }}</div><div class="lbl">Completed</div></div></div>
        </div>

        <div v-if="activeTab === 'browse'">
          <div class="section-title">Browse Treks</div>
          <div class="st-card" style="padding: 16px; margin-bottom: 20px;">
            <div class="row g-2">
              <div class="col-md-3">
                <select class="form-input-st" style="margin-bottom:0;" v-model="filterDifficulty">
                  <option value="">Any Difficulty</option>
                  <option>Easy</option><option>Moderate</option><option>Hard</option>
                </select>
              </div>
              <div class="col-md-3">
                <input class="form-input-st" style="margin-bottom:0;" placeholder="Location" v-model="filterLocation" />
              </div>
              <div class="col-md-2">
                <input class="form-input-st" style="margin-bottom:0;" type="number" placeholder="Days" v-model="filterDuration" />
              </div>
              <div class="col-md-2">
                <input class="form-input-st" style="margin-bottom:0;" placeholder="Search" v-model="filterSearch" />
              </div>
              <div class="col-md-2 d-flex gap-2">
                <button class="btn-primary-st" @click="loadBrowseTreks">Filter</button>
                <button class="btn-outline-st" @click="clearFilters">Clear</button>
              </div>
            </div>
          </div>

          <div class="row g-3">
            <div class="col-md-4" v-for="t in browseTreks" :key="t.trek_id">
              <div class="st-card">
                <div class="trek-img-placeholder">
                  <i class="ti ti-mountain"></i>
                  <span :class="['badge-difficulty', 'badge-' + t.difficulty]">{{ t.difficulty }}</span>
                </div>
                <div style="padding: 14px;">
                  <div style="font-weight:600; color:#0C447C; font-size:16px;">{{ t.trek_name }}</div>
                  <div style="font-size:13px; color:#6c757d; margin-bottom:8px;">{{ t.location }} • {{ t.duration_days }} days</div>
                  <div style="font-size:13px; color:#333; margin-bottom:10px;">
                    {{ t.start_date }} → {{ t.end_date }} <br/>
                    Slots left: {{ t.available_slots }} / {{ t.total_slots }}
                  </div>
                  <button class="btn-primary-st" :disabled="t.available_slots <= 0" @click="bookTrek(t)">
                    {{ t.available_slots <= 0 ? 'Fully Booked' : 'Book Now' }}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div v-if="browseTreks.length === 0" style="color:#6c757d; padding: 20px 0;">No treks match your filters.</div>
        </div>

        <div v-if="activeTab === 'bookings'">
          <div class="section-title">My Bookings</div>
          <table class="table-st">
            <thead><tr><th>Trek</th><th>Location</th><th>Dates</th><th>Status</th><th>Payment</th><th></th></tr></thead>
            <tbody>
              <tr v-for="b in myBookingsList" :key="b.booking_id">
                <td>{{ b.trek_name }}</td>
                <td>{{ b.location }}</td>
                <td>{{ b.start_date }} → {{ b.end_date }}</td>
                <td>{{ b.booking_status }}</td>
                <td>{{ b.payment_status }}</td>
                <td>
                  <button v-if="b.booking_status === 'Booked'" class="btn-outline-st" style="width:auto; color:#A32D2D; border-color:#A32D2D;" @click="cancelBooking(b)">Cancel</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="activeTab === 'history'">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <div class="section-title mb-0">Trekking History</div>
            <button v-if="exportState === 'idle'" class="btn-outline-st" style="width:auto;" @click="startExport">Export as CSV</button>
            <button v-else-if="exportState === 'pending'" class="btn-outline-st" style="width:auto;" disabled>Preparing export...</button>
            <button v-else-if="exportState === 'ready'" class="btn-primary-st" style="width:auto;" @click="downloadExport">Download CSV</button>
          </div>
          <table class="table-st">
            <thead><tr><th>Trek</th><th>Location</th><th>Booked On</th><th>Status</th></tr></thead>
            <tbody>
              <tr v-for="h in historyList" :key="h.booking_id">
                <td>{{ h.trek_name }}</td>
                <td>{{ h.location }}</td>
                <td>{{ h.booked_on }}</td>
                <td>{{ h.booking_status }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div v-if="showProfileModal" class="modal-overlay" @click.self="showProfileModal = false">
        <div class="modal-box">
          <h5>Edit Profile</h5>
          <label class="form-label-st">Full Name</label>
          <input class="form-input-st" v-model="profileForm.full_name" />
          <label class="form-label-st">Phone Number</label>
          <input class="form-input-st" v-model="profileForm.phone_no" placeholder="Leave blank to keep current" />
          <label class="form-label-st">New Password</label>
          <input class="form-input-st" type="password" v-model="profileForm.new_password" placeholder="Leave blank to keep current" />
          <div class="d-flex gap-2">
            <button class="btn-primary-st" @click="saveProfile">Save</button>
            <button class="btn-outline-st" @click="showProfileModal = false">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  `
};