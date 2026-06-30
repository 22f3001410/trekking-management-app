const StaffDash = {
  data() {
    return {
      staffName: '',
      assignedTreks: [],
      totalAssigned: 0,
      activeTrekId: null,
      participantsList: [],
      slotsDraft: '',
      statusDraft: '',
      bannerMsg: '',
      bannerType: 'success',
      isLoadingParticipants: false
    };
  },
  created() {
    this.loadDashboard();
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
    async loadDashboard() {
      const res = await fetch('/api/staff/dashboard', { headers: this.authHeaders() });
      const payload = await res.json();
      if (!res.ok) {
        this.flashBanner(payload.error || 'Could not load dashboard', 'danger');
        return;
      }
      this.staffName = payload.staff_name;
      this.assignedTreks = payload.assigned_treks;
      this.totalAssigned = payload.total_assigned;
    },
    openTrekPanel(trek) {
      if (this.activeTrekId === trek.trek_id) {
        this.activeTrekId = null;
        return;
      }
      this.activeTrekId = trek.trek_id;
      this.slotsDraft = trek.available_slots;
      this.statusDraft = trek.status;
      this.loadParticipants(trek.trek_id);
    },
    async loadParticipants(trekId) {
      this.isLoadingParticipants = true;
      const res = await fetch('/api/staff/treks/' + trekId + '/participants', { headers: this.authHeaders() });
      const payload = await res.json();
      this.isLoadingParticipants = false;
      if (!res.ok) {
        this.flashBanner(payload.error || 'Could not load participants', 'danger');
        return;
      }
      this.participantsList = payload;
    },
    async saveSlots(trek) {
      const res = await fetch('/api/staff/treks/' + trek.trek_id + '/slots', {
        method: 'PUT',
        headers: this.authHeaders(),
        body: JSON.stringify({ available_slots: this.slotsDraft })
      });
      const payload = await res.json();
      if (!res.ok) {
        this.flashBanner(payload.error || 'Could not update slots', 'danger');
        return;
      }
      this.flashBanner('Slots updated', 'success');
      this.loadDashboard();
    },
    async saveStatus(trek) {
      const res = await fetch('/api/staff/treks/' + trek.trek_id + '/status', {
        method: 'PUT',
        headers: this.authHeaders(),
        body: JSON.stringify({ status: this.statusDraft })
      });
      const payload = await res.json();
      if (!res.ok) {
        this.flashBanner(payload.error || 'Could not update status', 'danger');
        return;
      }
      this.flashBanner('Status set to ' + this.statusDraft, 'success');
      this.loadDashboard();
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
          <span style="color:#fff; margin-right:16px;">{{ staffName }}</span>
          <a href="#" @click.prevent="doLogout">Logout</a>
        </div>
      </div>

      <div style="padding: 24px 32px;">
        <div v-if="bannerMsg" :class="['alert-st', bannerType === 'danger' ? 'alert-danger' : 'alert-success']">{{ bannerMsg }}</div>

        <div class="section-title">Your Assigned Treks ({{ totalAssigned }})</div>

        <div v-if="assignedTreks.length === 0" style="color:#6c757d; padding: 20px 0;">
          No treks have been assigned to you yet.
        </div>

        <div class="row g-3">
          <div class="col-md-6" v-for="t in assignedTreks" :key="t.trek_id">
            <div class="st-card" style="padding: 18px;">
              <div class="d-flex justify-content-between align-items-start">
                <div>
                  <div style="font-weight:600; color:#0C447C; font-size:16px;">{{ t.trek_name }}</div>
                  <div style="font-size:13px; color:#6c757d;">{{ t.location }} • {{ t.duration_days }} days</div>
                </div>
                <span :class="['badge-difficulty', 'badge-' + t.difficulty]">{{ t.difficulty }}</span>
              </div>

              <div style="margin-top:12px; font-size:13px; color:#333;">
                Slots: {{ t.available_slots }} / {{ t.total_slots }} &nbsp;|&nbsp;
                Status: {{ t.status }} &nbsp;|&nbsp;
                Registered: {{ t.registered_users }}
              </div>

              <button class="btn-outline-st" style="width:auto; margin-top:12px;" @click="openTrekPanel(t)">
                {{ activeTrekId === t.trek_id ? 'Hide Details' : 'Manage Trek' }}
              </button>

              <div v-if="activeTrekId === t.trek_id" style="margin-top:16px; border-top: 0.5px solid #dde4ed; padding-top:16px;">
                <label class="form-label-st">Available Slots</label>
                <div class="d-flex gap-2">
                  <input class="form-input-st" style="margin-bottom:0;" type="number" v-model="slotsDraft" :max="t.total_slots" min="0" />
                  <button class="btn-primary-st" style="width:auto;" @click="saveSlots(t)">Save</button>
                </div>

                <label class="form-label-st" style="margin-top:14px;">Trek Status</label>
                <div class="d-flex gap-2">
                  <select class="form-input-st" style="margin-bottom:0;" v-model="statusDraft">
                    <option>Open</option>
                    <option>Closed</option>
                    <option>Completed</option>
                  </select>
                  <button class="btn-primary-st" style="width:auto;" @click="saveStatus(t)">Save</button>
                </div>

                <div style="margin-top:16px;">
                  <div style="font-size:13px; font-weight:600; color:#0C447C; margin-bottom:8px;">Registered Participants</div>
                  <div v-if="isLoadingParticipants" style="color:#6c757d; font-size:13px;">Loading...</div>
                  <table v-else-if="participantsList.length > 0" class="table-st">
                    <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Status</th></tr></thead>
                    <tbody>
                      <tr v-for="p in participantsList" :key="p.booking_id">
                        <td>{{ p.full_name }}</td>
                        <td>{{ p.email_addr }}</td>
                        <td>{{ p.phone_no }}</td>
                        <td>{{ p.booking_status }}</td>
                      </tr>
                    </tbody>
                  </table>
                  <div v-else style="color:#6c757d; font-size:13px;">No bookings yet for this trek.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
};