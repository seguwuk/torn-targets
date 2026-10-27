import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { firstValueFrom, interval, Subscription } from 'rxjs';
import targetData from '../../../json/target_list.json';

interface TargetItem {
  name: string;
  level: number;
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
  status_state?: string;
  status_description?: string;
  status_until?: number;
  life_current?: number;
  life_maximum?: number;
  last_action_relative?: string;
  last_action_timestamp?: number;
}

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
  private targetFileName = 'torn-targets-updated.json';

  sortMode: 'name' | 'level' | 'status' | 'lastUpdate' | 'health' | 'lastAction' | 'lastAttack' = 'lastAction';
  sortOrder: 'recent' | 'oldest' = 'recent';
  apiKey = '';
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
      const aValue = this.getSortValue(a);
      const bValue = this.getSortValue(b);

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const textCompare = aValue.localeCompare(bValue);
        return this.sortOrder === 'recent' ? textCompare : -textCompare;
      }

      const numericCompare = Number(aValue) - Number(bValue);
      return this.sortOrder === 'recent' ? -numericCompare : numericCompare;
    });
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

  private getLastActionAgeDays(lastAction: string): number {
    const minutes = this.parseLastAction(lastAction);

    if (minutes === Number.MAX_SAFE_INTEGER) {
      return Number.MAX_SAFE_INTEGER;
    }

    return Math.floor(minutes / 1440);
  }

  sortBy(column: 'name' | 'level' | 'status' | 'lastUpdate' | 'health' | 'lastAction' | 'lastAttack'): void {
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

    this.targetFileName = this.getUpdatedFileName(file.name);
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
    link.download = this.targetFileName;
    link.click();
    URL.revokeObjectURL(downloadUrl);
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

    try {
      for (let index = 0; index < targetsToRefresh.length; index += 1) {
        if (index > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        const target = targetsToRefresh[index];
        const liveData = await this.fetchTargetLiveData(target.id, key);
        Object.assign(target.data, liveData);
        target.lastUpdatedAt = Date.now();
        this.refreshProgress = index + 1;
        this.refreshMessage = `Updated ${this.refreshProgress} of ${targetsToRefresh.length} targets.`;
      }

      this.refreshMessage = `Updated all ${targetsToRefresh.length} targets.`;
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
      const liveData = await this.fetchTargetLiveData(target.id, key);
      Object.assign(target.data, liveData);
      target.lastUpdatedAt = Date.now();
      this.refreshMessage = `Updated ${target.data.name}.`;
    } catch (error) {
      this.refreshMessage = `Could not refresh ${target.data.name}: ${this.getRefreshErrorMessage(error)}`;
    } finally {
      this.isRefreshing = false;
    }
  }

  private async fetchTargetLiveData(id: string, key: string): Promise<TargetLiveData> {
    if (!/^\d+$/.test(id)) {
      throw new Error(`Target ID "${id}" is not a valid Torn user ID.`);
    }

    const params = new HttpParams()
      .set('selections', 'basic')
      .set('key', key);
    const response = await firstValueFrom(
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

    const status = response['status'];
    const statusUntil = this.isRecord(status) ? status['until'] : undefined;
    const lastAction = response['last_action'];
    const life = response['life'];
    const lifeCurrent = this.isRecord(life) ? life['current'] : undefined;
    const lifeMaximum = this.isRecord(life) ? life['maximum'] : undefined;
    const liveData: TargetLiveData = {};
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

    if (
      !liveData.status_state &&
      liveData.life_current === undefined &&
      liveData.last_action_relative === undefined
    ) {
      throw new Error('Torn did not return status, health, or last-action information for this target.');
    }

    return liveData;
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

  getLastUpdateTime(timestamp?: number): string {
    return timestamp === undefined ? 'Never' : this.getRelativeTime(Math.floor(timestamp / 1000));
  }

  private getUpdatedFileName(fileName: string): string {
    const extensionIndex = fileName.lastIndexOf('.');
    const baseName = extensionIndex > 0 ? fileName.slice(0, extensionIndex) : fileName;
    return `${baseName}-updated.json`;
  }

  getHospitalCountdown(target: TargetListItem): string | undefined {
    if (target.data.status_state?.toLowerCase() !== 'hospital' || target.data.status_until === undefined) {
      return undefined;
    }

    const remainingSeconds = Math.max(
      0,
      Math.ceil(target.data.status_until - this.currentTime / 1000)
    );

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
    const match = value.match(/(\d+)\s*(minute|minutes|hour|hours|day|days)/i);

    if (!match) {
      return Number.MAX_SAFE_INTEGER;
    }

    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();

    switch (unit) {
      case 'minute':
      case 'minutes':
        return amount;
      case 'hour':
      case 'hours':
        return amount * 60;
      case 'day':
      case 'days':
        return amount * 60 * 24;
      default:
        return Number.MAX_SAFE_INTEGER;
    }
  }
}
