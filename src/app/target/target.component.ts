import { Component } from '@angular/core';
import targetData from '../../../json/target_list.json';

interface TargetItem {
  name: string;
  level: number;
  status_state: string;
  life_current: number;
  life_maximum: number;
  last_action_relative: string;
  last_attack_timestamp: number;
  result: string;
}

interface TargetListItem {
  id: string;
  data: TargetItem;
}

@Component({
  selector: 'app-target',
  templateUrl: './target.component.html',
  styleUrls: ['./target.component.scss']
})
export class TargetComponent {
  targets: TargetListItem[] = Object.entries(targetData as Record<string, TargetItem>).map(([id, data]) => ({
    id,
    data
  }));

  sortMode: 'name' | 'level' | 'lastAction' | 'lastAttack' = 'lastAction';
  sortOrder: 'recent' | 'oldest' = 'recent';

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
