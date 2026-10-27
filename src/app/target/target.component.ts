import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Component } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import targetData from '../../../json/target_list.json';

interface TargetItem {
  name: string;
  level: number;
  status_state?: string;
  status_description?: string;
  life_current?: number;
  life_maximum?: number;
  last_action_relative: string;
  last_attack_timestamp: number;
  result: string;
}

interface TargetListItem {
  id: string;
  data: TargetItem;
}

interface TargetLiveData {
  status_state?: string;
  status_description?: string;
  life_current?: number;
  life_maximum?: number;
}

@Component({
  selector: 'app-target',
  templateUrl: './target.component.html',
  styleUrls: ['./target.component.scss']
})
export class TargetComponent {
  constructor(private readonly http: HttpClient) {}

  targets: TargetListItem[] = Object.entries(targetData as Record<string, TargetItem>).map(([id, data]) => ({
    id,
    data
  }));

  sortMode: 'name' | 'level' | 'lastAction' | 'lastAttack' = 'lastAction';
  sortOrder: 'recent' | 'oldest' = 'recent';
  apiKey = '';
  isRefreshing = false;
  refreshProgress = 0;
  refreshMessage = '';

  get sortedTargets(): TargetListItem[] {
    return [...this.targets].sort((a, b) => {
      const aValue = this.getSortValue(a.data);
      const bValue = this.getSortValue(b.data);

      if (this.sortMode === 'name') {
        const nameCompare = a.data.name.localeCompare(b.data.name);
        return this.sortOrder === 'recent' ? nameCompare : -nameCompare;
      }

      const numericCompare = aValue - bValue;
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

  sortBy(column: 'name' | 'level' | 'lastAction' | 'lastAttack'): void {
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

  async refreshTargets(): Promise<void> {
    const key = this.apiKey.trim();

    if (!key || !this.targets.length || this.isRefreshing) {
      return;
    }

    const targetsToRefresh = [...this.targets];
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
    const life = response['life'];
    const lifeCurrent = this.isRecord(life) ? life['current'] : undefined;
    const lifeMaximum = this.isRecord(life) ? life['maximum'] : undefined;
    const liveData: TargetLiveData = {
      status_state: this.isRecord(status) && typeof status['state'] === 'string'
        ? status['state']
        : undefined,
      status_description: this.isRecord(status) && typeof status['description'] === 'string'
        ? status['description']
        : undefined,
      life_current: typeof lifeCurrent === 'number' ? lifeCurrent : undefined,
      life_maximum: typeof lifeMaximum === 'number' ? lifeMaximum : undefined
    };

    if (!liveData.status_state && liveData.life_current === undefined) {
      throw new Error('Torn did not return status or health information for this target.');
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

  private getSortValue(target: TargetItem): number {
    switch (this.sortMode) {
      case 'name':
        return target.name.toLowerCase().localeCompare(target.name.toLowerCase());
      case 'level':
        return target.level;
      case 'lastAttack':
        return target.last_attack_timestamp || 0;
      case 'lastAction':
      default:
        return this.parseLastAction(target.last_action_relative);
    }
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
