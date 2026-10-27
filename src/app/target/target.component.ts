import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { firstValueFrom, interval, Subscription } from 'rxjs';
import targetData from '../../../json/target_list.json';

interface TargetItem {
  name: string;
  level: number;
  fair_fight?: number | string;
  status_state?: string;
  status_description?: string;
  status_until?: number;
  life_current?: number;
  life_maximum?: number;
  last_action_relative: string;
  last_action_timestamp?: number;
  last_attack_timestamp: number;
  result: string;
}

interface TargetListItem {
  id: string;
  data: TargetItem;
  lastUpdatedAt?: number;
}

interface TargetLiveData {
  fair_fight?: number;
  status_state?: string;
  status_description?: string;
  status_until?: number;
  life_current?: number;
  life_maximum?: number;
  last_action_relative?: string;
  last_action_timestamp?: number;
  last_attack_timestamp?: number;
}

interface AttackHistoryEntry {
  timestamp: number;
  fairFight?: number;
}

const HOSPITAL_COUNTDOWN_OFFSET_SECONDS = 60;

@Component({
  selector: 'app-target',
  templateUrl: './target.component.html',
  styleUrls: ['./target.component.scss']
})
export class TargetComponent implements OnInit, OnDestroy {
  constructor(private readonly http: HttpClient) {}

  targets: TargetListItem[] = Object.entries(targetData as Record<string, TargetItem>).map(([id, data]) => ({
    id,
    data
  }));
  private targetFileBaseName = 'torn-targets';
  private downloadSequence = 1;

  sortMode:
    | 'name'
    | 'fairFight'
    | 'level'
    | 'status'
    | 'lastUpdate'
    | 'health'
    | 'lastAction'
    | 'lastAttack' = 'lastAction';
  sortOrder: 'recent' | 'oldest' = 'recent';
  apiKey = '';
  targetFilter = '';
  isDarkMode = localStorage.getItem('torn-targets-dark-mode') === 'true';
  isRefreshing = false;
  refreshProgress = 0;
  refreshMessage = '';
  currentTime = Date.now();
  private clockSubscription?: Subscription;

  ngOnInit(): void {
    document.body.classList.toggle('dark-mode', this.isDarkMode);
    this.clockSubscription = interval(1000).subscribe(() => {
      this.currentTime = Date.now();
    });
  }

  ngOnDestroy(): void {
    this.clockSubscription?.unsubscribe();
  }

  toggleDarkMode(): void {
    this.isDarkMode = !this.isDarkMode;
    localStorage.setItem('torn-targets-dark-mode', String(this.isDarkMode));
    document.body.classList.toggle('dark-mode', this.isDarkMode);
  }

  get sortedTargets(): TargetListItem[] {
    return [...this.targets].sort((a, b) => {
      if (this.sortMode === 'fairFight') {
        const fairFightCompare = this.compareFairFight(a, b);
        return fairFightCompare;
      }

      if (this.sortMode === 'status') {
        const statusCompare = this.compareTargetStatus(a, b);
        return this.sortOrder === 'recent' ? statusCompare : -statusCompare;
      }

      const aValue = this.getSortValue(a);
      const bValue = this.getSortValue(b);

      if (this.sortMode === 'lastAction') {
        const aUnknown = aValue === Number.MAX_SAFE_INTEGER;
        const bUnknown = bValue === Number.MAX_SAFE_INTEGER;
        if (aUnknown !== bUnknown) {
          return aUnknown ? 1 : -1;
        }

        const ageCompare = Number(aValue) - Number(bValue);
        return this.sortOrder === 'recent' ? ageCompare : -ageCompare;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const textCompare = aValue.localeCompare(bValue);
        return this.sortOrder === 'recent' ? textCompare : -textCompare;
      }

      const numericCompare = Number(aValue) - Number(bValue);
      return this.sortOrder === 'recent' ? -numericCompare : numericCompare;
    });
  }

  get filteredTargets(): TargetListItem[] {
    const filter = this.targetFilter.trim().toLowerCase();
    if (!filter) {
      return this.sortedTargets;
    }

    return this.sortedTargets.filter(({ id, data }) =>
      data.name.toLowerCase().includes(filter) ||
      id.includes(filter) ||
      String(data.level).includes(filter) ||
      (data.status_description || data.status_state || '').toLowerCase().includes(filter)
    );
  }

  attackTarget(id: string): void {
    window.open(`https://www.torn.com/page.php?sid=attack&user2ID=${id}`, '_blank');
    console.log('Attack target ID:', id);
  }

  getLastActionAgeClass(target: TargetItem): string {
    const days = this.getLastActionAgeDays(target.last_action_relative);

    if (days < 10) {
      return 'target-list__item--recent';
    }

    if (days <= 30) {
      return 'target-list__item--moderate';
    }

    return 'target-list__item--stale';
  }

  getTargetStatusClass(target: TargetListItem): string {
    const status = target.data.status_state?.toLowerCase();

    if (!status) {
      return 'target-list__status--unknown';
    }

    return status === 'okay'
      ? 'target-list__status--safe'
      : 'target-list__status--restricted';
  }

  private getLastActionAgeDays(lastAction: string): number {
    const seconds = this.parseLastAction(lastAction);

    if (seconds === Number.MAX_SAFE_INTEGER) {
      return Number.MAX_SAFE_INTEGER;
    }

    return Math.floor(seconds / 86400);
  }

  sortBy(
    column: 'name' | 'fairFight' | 'level' | 'status' | 'lastUpdate' | 'health' | 'lastAction' | 'lastAttack'
  ): void {
    if (this.sortMode === column) {
      this.sortOrder = this.sortOrder === 'recent' ? 'oldest' : 'recent';
    } else {
      this.sortMode = column;
      this.sortOrder = 'recent';
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    this.setTargetFileName(file.name);
    const reader = new FileReader();

    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);

        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          throw new Error('Invalid JSON structure. Expected an object with target entries.');
        }

        this.targets = Object.entries(parsed as Record<string, TargetItem>).map(([id, data]) => ({
          id,
          data
        }));
      } catch (error) {
        console.error('Failed to load target JSON:', error);
        window.alert('Failed to load JSON file. Please select a valid target JSON file.');
      }
    };

    reader.readAsText(file);
  }

  downloadUpdatedJson(): void {
    const json = this.getUpdatedJson();
    const blob = new Blob([json], { type: 'application/json' });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = this.getNextDownloadFileName();
    link.click();
    URL.revokeObjectURL(downloadUrl);
  }

  getNextDownloadFileName(): string {
    const fileName = `${this.targetFileBaseName}-${this.downloadSequence}.json`;
    this.downloadSequence += 1;
    return fileName;
  }

  getUpdatedJson(): string {
    return JSON.stringify(
      Object.fromEntries(this.targets.map(({ id, data }) => [id, data])),
      null,
      2
    );
  }

  async refreshTargets(): Promise<void> {
    const key = this.apiKey.trim();

    if (!key || !this.targets.length || this.isRefreshing) {
      return;
    }

    const targetsToRefresh = [...this.sortedTargets];
    this.isRefreshing = true;
    this.refreshProgress = 0;
    this.refreshMessage = 'Starting refresh...';
    let attackHistory: Map<string, AttackHistoryEntry> | undefined;
    let attackHistoryWarning = '';

    try {
      try {
        attackHistory = await this.fetchMyAttackHistory(key);
      } catch (error) {
        attackHistoryWarning = this.getRefreshErrorMessage(error);
      }

      for (let index = 0; index < targetsToRefresh.length; index += 1) {
        if (index > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        const target = targetsToRefresh[index];
        const liveData = await this.fetchTargetLiveData(target.id, key, attackHistory);
        if (liveData.last_attack_timestamp !== undefined) {
          liveData.last_attack_timestamp = Math.max(
            target.data.last_attack_timestamp || 0,
            liveData.last_attack_timestamp
          );
        }
        Object.assign(target.data, liveData);
        target.lastUpdatedAt = Date.now();
        this.refreshProgress = index + 1;
        this.refreshMessage = `Updated ${this.refreshProgress} of ${targetsToRefresh.length} targets.`;
      }

      this.refreshMessage = attackHistoryWarning
        ? `Updated all ${targetsToRefresh.length} targets. Last attack and Fair Fight data were not updated: ${attackHistoryWarning}`
        : `Updated all ${targetsToRefresh.length} targets.`;
    } catch (error) {
      this.refreshMessage =
        `Refresh stopped after ${this.refreshProgress} of ${targetsToRefresh.length} targets: ` +
        this.getRefreshErrorMessage(error);
    } finally {
      this.isRefreshing = false;
      this.apiKey = '';
    }
  }

  async refreshTarget(target: TargetListItem): Promise<void> {
    const key = this.apiKey.trim();

    if (this.isRefreshing) {
      return;
    }

    if (!key) {
      this.refreshMessage = 'Enter your Torn API key to refresh a target.';
      return;
    }

    this.isRefreshing = true;
    this.refreshMessage = `Refreshing ${target.data.name}...`;

    try {
      let attackHistory: Map<string, AttackHistoryEntry> | undefined;
      let attackHistoryWarning = '';
      try {
        attackHistory = await this.fetchMyAttackHistory(key);
      } catch (error) {
        attackHistoryWarning = this.getRefreshErrorMessage(error);
      }

      const liveData = await this.fetchTargetLiveData(target.id, key, attackHistory);
      if (liveData.last_attack_timestamp !== undefined) {
        liveData.last_attack_timestamp = Math.max(
          target.data.last_attack_timestamp || 0,
          liveData.last_attack_timestamp
        );
      }
      Object.assign(target.data, liveData);
      target.lastUpdatedAt = Date.now();
      this.refreshMessage = attackHistoryWarning
        ? `Updated ${target.data.name}. Last attack and Fair Fight data were not updated: ${attackHistoryWarning}`
        : `Updated ${target.data.name}.`;
    } catch (error) {
      this.refreshMessage = `Could not refresh ${target.data.name}: ${this.getRefreshErrorMessage(error)}`;
    } finally {
      this.isRefreshing = false;
    }
  }

  private async fetchTargetLiveData(
    id: string,
    key: string,
    attackHistory?: Map<string, AttackHistoryEntry>
  ): Promise<TargetLiveData> {
    if (!/^\d+$/.test(id)) {
      throw new Error(`Target ID "${id}" is not a valid Torn user ID.`);
    }

    const response = await this.requestTornData(id, 'basic', key);

    const status = response['status'];
    const statusUntil = this.isRecord(status) ? status['until'] : undefined;
    const lastAction = response['last_action'];
    const life = response['life'];
    const fairFight = response['fair_fight'];
    const lifeCurrent = this.isRecord(life) ? life['current'] : undefined;
    const lifeMaximum = this.isRecord(life) ? life['maximum'] : undefined;
    const liveData: TargetLiveData = { status_until: undefined };
    if (typeof fairFight === 'number' && Number.isFinite(fairFight)) {
      liveData.fair_fight = fairFight;
    } else if (
      typeof fairFight === 'string' &&
      fairFight.trim() !== '' &&
      Number.isFinite(Number(fairFight))
    ) {
      liveData.fair_fight = Number(fairFight);
    }
    if (this.isRecord(status)) {
      if (typeof status['state'] === 'string') {
        liveData.status_state = status['state'];
      }
      if (typeof status['description'] === 'string') {
        liveData.status_description = status['description'];
      }
      if (typeof statusUntil === 'number' && Number.isFinite(statusUntil) && statusUntil > 0) {
        liveData.status_until = statusUntil;
      }
    }
    if (typeof lifeCurrent === 'number') {
      liveData.life_current = lifeCurrent;
    }
    if (typeof lifeMaximum === 'number') {
      liveData.life_maximum = lifeMaximum;
    }
    if (this.isRecord(lastAction)) {
      if (typeof lastAction['relative'] === 'string') {
        liveData.last_action_relative = lastAction['relative'];
      }
      if (typeof lastAction['timestamp'] === 'number' && Number.isFinite(lastAction['timestamp'])) {
        liveData.last_action_timestamp = lastAction['timestamp'];
      }
    }
    const lastAttack = attackHistory?.get(id);
    if (lastAttack !== undefined) {
      liveData.last_attack_timestamp = lastAttack.timestamp;
      if (liveData.fair_fight === undefined && lastAttack.fairFight !== undefined) {
        liveData.fair_fight = lastAttack.fairFight;
      }
    }

    if (
      !liveData.status_state &&
      liveData.life_current === undefined &&
      liveData.last_action_relative === undefined
    ) {
      throw new Error('Torn did not return status, health, or last-action information for this target.');
    }

    return liveData;
  }

  private async fetchMyAttackHistory(key: string): Promise<Map<string, AttackHistoryEntry>> {
    const ownProfile = await this.requestTornData('', 'basic', key);
    const playerId = ownProfile['player_id'];
    if (typeof playerId !== 'number' && typeof playerId !== 'string') {
      throw new Error('Torn did not return your player ID.');
    }

    const ownId = String(playerId);
    const attackResponse = await this.requestTornData(ownId, 'attacksfull', key);
    const attacks = attackResponse['attacks'];
    if (!this.isRecord(attacks)) {
      throw new Error('Torn did not return your full attack history.');
    }

    const attackHistory = new Map<string, AttackHistoryEntry>();
    for (const attack of Object.values(attacks)) {
      if (!this.isRecord(attack)) {
        continue;
      }

      const attackerId = String(attack['attacker_id'] ?? '');
      const defenderId = attack['defender_id'];
      const timestamp = attack['timestamp_ended'];
      if (
        attackerId === ownId &&
        (typeof defenderId === 'number' || typeof defenderId === 'string') &&
        typeof timestamp === 'number' &&
        Number.isFinite(timestamp) &&
        timestamp > 0
      ) {
        const targetId = String(defenderId);
        const modifiers = attack['modifiers'];
        const fairFightValue = this.isRecord(modifiers) ? modifiers['fair_fight'] : undefined;
        const fairFight = this.toFiniteNumber(fairFightValue);
        const previousAttack = attackHistory.get(targetId);
        if (!previousAttack || timestamp >= previousAttack.timestamp) {
          attackHistory.set(targetId, {
            timestamp,
            fairFight: fairFight ?? previousAttack?.fairFight
          });
        }
      }
    }

    return attackHistory;
  }

  private toFiniteNumber(value: unknown): number | undefined {
    if (typeof value !== 'number' && typeof value !== 'string') {
      return undefined;
    }

    if (typeof value === 'string' && value.trim() === '') {
      return undefined;
    }

    const number = Number(value);
    return Number.isFinite(number) ? number : undefined;
  }

  private async requestTornData(
    id: string,
    selection: string,
    key: string
  ): Promise<Record<string, unknown>> {
    const params = new HttpParams()
      .set('selections', selection)
      .set('key', key);
    const response: unknown = await firstValueFrom(
      this.http.get<unknown>(`https://api.torn.com/user/${id}`, { params })
    );

    if (!this.isRecord(response)) {
      throw new Error('Torn returned an unexpected response.');
    }

    const apiError = response['error'];
    if (this.isRecord(apiError)) {
      const message = typeof apiError['error'] === 'string'
        ? apiError['error']
        : 'Torn API returned an error.';
      throw new Error(message);
    }

    return response;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private getRefreshErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      return error.status === 0
        ? 'Could not reach Torn API (network or browser CORS issue).'
        : `Torn API request failed with HTTP ${error.status}.`;
    }

    return error instanceof Error ? error.message : 'An unexpected error occurred.';
  }

  private getSortValue(target: TargetListItem): number | string {
    switch (this.sortMode) {
      case 'name':
        return target.data.name.toLowerCase();
      case 'level':
        return target.data.level;
      case 'status':
        return (target.data.status_description || target.data.status_state || '').toLowerCase();
      case 'lastUpdate':
        return target.lastUpdatedAt || 0;
      case 'health':
        return target.data.life_current ?? 0;
      case 'lastAttack':
        return target.data.last_attack_timestamp || 0;
      case 'lastAction':
      default:
        return this.parseLastAction(target.data.last_action_relative);
    }
  }

  private compareFairFight(a: TargetListItem, b: TargetListItem): number {
    const aValue = this.getFairFightValue(a);
    const bValue = this.getFairFightValue(b);

    if (aValue === undefined || bValue === undefined) {
      if (aValue === bValue) {
        return a.data.name.localeCompare(b.data.name);
      }

      return aValue === undefined ? 1 : -1;
    }

    const compare = aValue - bValue;
    return this.sortOrder === 'recent' ? -compare : compare;
  }

  private getFairFightValue(target: TargetListItem): number | undefined {
    if (target.data.fair_fight === undefined || String(target.data.fair_fight).trim() === '') {
      return undefined;
    }

    const value = Number(target.data.fair_fight);
    return Number.isFinite(value) ? value : undefined;
  }

  private compareTargetStatus(a: TargetListItem, b: TargetListItem): number {
    const aState = a.data.status_state?.toLowerCase();
    const bState = b.data.status_state?.toLowerCase();
    const aRank = this.getStatusSortRank(aState);
    const bRank = this.getStatusSortRank(bState);

    if (aRank !== bRank) {
      return aRank - bRank;
    }

    if (aRank === 1) {
      return this.getHospitalSortTime(a) - this.getHospitalSortTime(b);
    }

    const aStatus = (a.data.status_description || a.data.status_state || '').toLowerCase();
    const bStatus = (b.data.status_description || b.data.status_state || '').toLowerCase();
    return aStatus.localeCompare(bStatus);
  }

  private getStatusSortRank(state?: string): number {
    if (state === 'okay') {
      return 0;
    }

    if (state === 'hospital') {
      return 1;
    }

    return state ? 2 : 3;
  }

  private getHospitalSortTime(target: TargetListItem): number {
    return this.getHospitalRemainingSeconds(target) ?? Number.MAX_SAFE_INTEGER;
  }

  getLastUpdateTime(timestamp?: number): string {
    return timestamp === undefined ? 'Never' : this.getRelativeTime(Math.floor(timestamp / 1000));
  }

  private setTargetFileName(fileName: string): void {
    const extensionIndex = fileName.lastIndexOf('.');
    const nameWithoutExtension = extensionIndex > 0 ? fileName.slice(0, extensionIndex) : fileName;
    const numberedExport = nameWithoutExtension.match(/^(.*?)(?:-updated)?-(\d+)$/i);

    if (numberedExport) {
      this.targetFileBaseName = numberedExport[1];
      this.downloadSequence = Number(numberedExport[2]) + 1;
      return;
    }

    this.targetFileBaseName = nameWithoutExtension.replace(/-updated$/i, '') || 'torn-targets';
    this.downloadSequence = 1;
  }

  getHospitalCountdown(target: TargetListItem): string | undefined {
    const remainingSeconds = this.getHospitalRemainingSeconds(target);
    if (remainingSeconds === undefined) {
      return undefined;
    }

    if (remainingSeconds === 0) {
      return 'Time reached — refresh to confirm';
    }

    const seconds = remainingSeconds % 60;
    const totalMinutes = Math.floor(remainingSeconds / 60);
    const minutes = totalMinutes % 60;
    const hours = Math.floor(totalMinutes / 60);
    const clock = `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    const days = Math.floor(hours / 24);

    return days > 0
      ? `${days}d ${String(hours % 24).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      : clock;
  }

  private getHospitalRemainingSeconds(target: TargetListItem): number | undefined {
    if (target.data.status_state?.toLowerCase() !== 'hospital') {
      return undefined;
    }

    const statusUntil = Number(target.data.status_until);
    if (!Number.isFinite(statusUntil) || statusUntil <= 0) {
      return undefined;
    }

    return Math.max(
      0,
      Math.ceil(
        statusUntil - this.currentTime / 1000 - HOSPITAL_COUNTDOWN_OFFSET_SECONDS
      )
    );
  }

  getRelativeTime(timestamp: number): string {
    const now = Math.floor(Date.now() / 1000);
    const diffInSeconds = Math.max(0, now - timestamp);
    const minutes = Math.floor(diffInSeconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days} day${days === 1 ? '' : 's'} ago`;
    }

    if (hours > 0) {
      return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    }

    if (minutes > 0) {
      return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    }

    return 'just now';
  }

  private parseLastAction(value: string): number {
    const matches = value.matchAll(/(\d+(?:\.\d+)?)\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?|days?)/gi);
    let totalSeconds = 0;
    let foundDuration = false;

    for (const match of matches) {
      const amount = Number(match[1]);
      const unit = match[2].toLowerCase();
      foundDuration = true;

      if (unit.startsWith('day')) {
        totalSeconds += amount * 86400;
      } else if (unit.startsWith('hour') || unit.startsWith('hr')) {
        totalSeconds += amount * 3600;
      } else if (unit.startsWith('min')) {
        totalSeconds += amount * 60;
      } else {
        totalSeconds += amount;
      }
    }

    return foundDuration ? totalSeconds : Number.MAX_SAFE_INTEGER;
  }
}
