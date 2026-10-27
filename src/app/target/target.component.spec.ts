import { ComponentFixture, fakeAsync, flushMicrotasks, TestBed, tick } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';

import { TargetComponent } from './target.component';

describe('TargetComponent', () => {
  let component: TargetComponent;
  let fixture: ComponentFixture<TargetComponent>;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.removeItem('torn-targets-dark-mode');
    TestBed.configureTestingModule({
      declarations: [TargetComponent],
      imports: [FormsModule, HttpClientTestingModule]
    });
    fixture = TestBed.createComponent(TargetComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.removeItem('torn-targets-dark-mode');
    document.body.classList.remove('dark-mode');
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('displays the imported fair-fight value between Attack and Level', () => {
    component.targets = [{
      id: '12345',
      data: {
        name: 'Target',
        level: 50,
        fair_fight: 1.75,
        last_action_relative: '1 day ago',
        last_attack_timestamp: 0,
        result: ''
      }
    }];
    fixture.detectChanges();

    const row = fixture.nativeElement.querySelector('.target-list__row') as HTMLElement;
    const columns = Array.from(row.children) as HTMLElement[];

    expect(columns[1].classList).toContain('target-list__attack');
    expect(columns[2].classList).toContain('target-list__fair-fight');
    expect(columns[2].textContent?.trim()).toBe('1.75');
    expect(columns[3].classList).toContain('target-list__level');
  });

  it('toggles dark mode and persists the preference', () => {
    component.toggleDarkMode();

    expect(component.isDarkMode).toBeTrue();
    expect(localStorage.getItem('torn-targets-dark-mode')).toBe('true');
    expect(document.body.classList.contains('dark-mode')).toBeTrue();

    component.toggleDarkMode();

    expect(component.isDarkMode).toBeFalse();
    expect(localStorage.getItem('torn-targets-dark-mode')).toBe('false');
    expect(document.body.classList.contains('dark-mode')).toBeFalse();
  });

  it('uses matching status colors for status labels and attack buttons', () => {
    component.targets = [
      {
        id: '1',
        data: {
          name: 'Hospital target',
          level: 50,
          status_state: 'Hospital',
          last_action_relative: '1 day ago',
          last_attack_timestamp: 0,
          result: ''
        }
      },
      {
        id: '2',
        data: {
          name: 'Okay target',
          level: 25,
          status_state: 'oKaY',
          last_action_relative: '2 days ago',
          last_attack_timestamp: 0,
          result: ''
        }
      }
    ];
    fixture.detectChanges();

    const rows = Array.from(
      fixture.nativeElement.querySelectorAll('.target-list__item')
    ) as HTMLElement[];
    const hospitalRow = rows.find(row => row.textContent?.includes('Hospital target'));
    const okayRow = rows.find(row => row.textContent?.includes('Okay target'));

    expect(hospitalRow?.querySelector('.target-list__status')?.classList)
      .toContain('target-list__status--restricted');
    expect(hospitalRow?.querySelector('.target-list__attack')?.classList)
      .toContain('target-list__status--restricted');
    expect(okayRow?.querySelector('.target-list__status')?.classList)
      .toContain('target-list__status--safe');
    expect(okayRow?.querySelector('.target-list__attack')?.classList)
      .toContain('target-list__status--safe');
  });

  it('refreshes target status, health, last action, and matching personal attack', fakeAsync(() => {
    component.targets = [{
      id: '12345',
      data: {
        name: 'Target',
        level: 50,
        last_action_relative: '1 day ago',
        last_attack_timestamp: 0,
        result: ''
      }
    }];
    component.apiKey = 'personal-key';

    component.refreshTargets();
    const ownProfileRequest = httpMock.expectOne(
      request => request.url === 'https://api.torn.com/user/' &&
        request.params.get('selections') === 'basic'
    );
    ownProfileRequest.flush({ player_id: 555 });
    flushMicrotasks();

    const attacksRequest = httpMock.expectOne(
      request => request.url === 'https://api.torn.com/user/555' &&
        request.params.get('selections') === 'attacksfull'
    );
    attacksRequest.flush({
      attacks: {
        '1': {
          attacker_id: 555,
          defender_id: 12345,
          timestamp_ended: 1234567000,
          modifiers: { fair_fight: 1.65 }
        },
        '2': {
          attacker_id: 777,
          defender_id: 12345,
          timestamp_ended: 1234567999
        }
      }
    });
    flushMicrotasks();

    const request = httpMock.expectOne(
      request => request.url === 'https://api.torn.com/user/12345' &&
        request.params.get('selections') === 'basic'
    );
    expect(request.request.params.get('key')).toBe('personal-key');
    request.flush({
      status: { state: 'Okay', description: 'Okay' },
      life: { current: 75, maximum: 100 },
      last_action: { relative: '5 minutes ago', timestamp: 1234567890 }
    });

    flushMicrotasks();

    expect(component.targets[0].data.status_state).toBe('Okay');
    expect(component.targets[0].data.status_description).toBe('Okay');
    expect(component.targets[0].data.life_current).toBe(75);
    expect(component.targets[0].data.life_maximum).toBe(100);
    expect(component.targets[0].data.fair_fight).toBe(1.65);
    expect(component.targets[0].data.last_action_relative).toBe('5 minutes ago');
    expect(component.targets[0].data.last_action_timestamp).toBe(1234567890);
    expect(component.targets[0].data.last_attack_timestamp).toBe(1234567000);
    expect(JSON.parse(component.getUpdatedJson())['12345'].fair_fight).toBe(1.65);
    expect(component.apiKey).toBe('');
  }));

  it('exports target data under the original IDs', () => {
    component.targets = [{
      id: '12345',
      data: {
        name: 'Target',
        level: 50,
        status_state: 'Hospital',
        life_current: 75,
        life_maximum: 100,
        last_action_relative: '5 minutes ago',
        last_action_timestamp: 1234567890,
        last_attack_timestamp: 0,
        result: ''
      }
    }];

    expect(JSON.parse(component.getUpdatedJson())).toEqual({
      '12345': component.targets[0].data
    });
  });

  it('uses incrementing short JSON download names', () => {
    expect(component.getNextDownloadFileName()).toBe('torn-targets-1.json');
    expect(component.getNextDownloadFileName()).toBe('torn-targets-2.json');
  });

  it('refreshes only the selected target from its status refresh control', fakeAsync(() => {
    component.targets = [
      {
        id: '12345',
        data: {
          name: 'Selected target',
          level: 50,
          last_action_relative: '1 day ago',
          last_attack_timestamp: 0,
          result: ''
        }
      },
      {
        id: '67890',
        data: {
          name: 'Other target',
          level: 40,
          last_action_relative: '2 days ago',
          last_attack_timestamp: 0,
          result: ''
        }
      }
    ];
    component.apiKey = 'personal-key';

    component.refreshTarget(component.targets[0]);

    const ownProfileRequest = httpMock.expectOne(
      request => request.url === 'https://api.torn.com/user/' &&
        request.params.get('selections') === 'basic'
    );
    ownProfileRequest.flush({ player_id: 555 });
    flushMicrotasks();
    const attacksRequest = httpMock.expectOne(
      request => request.url === 'https://api.torn.com/user/555' &&
        request.params.get('selections') === 'attacksfull'
    );
    attacksRequest.flush({ attacks: {} });
    flushMicrotasks();

    const request = httpMock.expectOne(
      request => request.url === 'https://api.torn.com/user/12345' &&
        request.params.get('selections') === 'basic'
    );
    request.flush({
      status: { state: 'Hospital', description: 'In hospital', until: 1234567890 },
      life: { current: 75, maximum: 100 }
    });
    flushMicrotasks();

    expect(component.targets[0].data.status_state).toBe('Hospital');
    expect(component.targets[0].lastUpdatedAt).toBeDefined();
    expect(component.targets[1].data.status_state).toBeUndefined();
    expect(component.targets[1].lastUpdatedAt).toBeUndefined();
    expect(component.refreshMessage).toBe('Updated Selected target.');
    expect(component.apiKey).toBe('personal-key');
  }));

  it('sorts Okay targets first and hospital targets by time remaining', () => {
    component.currentTime = 1_700_000_000_000;
    component.targets = [
      {
        id: '1',
        data: {
          name: 'First',
          level: 50,
          status_state: 'Hospital',
          status_until: 1_700_000_600,
          life_current: 75,
          last_action_relative: '1 day ago',
          last_attack_timestamp: 0,
          result: ''
        },
        lastUpdatedAt: 2000
      },
      {
        id: '2',
        data: {
          name: 'Second',
          level: 50,
          status_state: 'Okay',
          life_current: 50,
          last_action_relative: '1 day ago',
          last_attack_timestamp: 0,
          result: ''
        },
        lastUpdatedAt: 1000
      },
      {
        id: '3',
        data: {
          name: 'Soonest hospital',
          level: 50,
          status_state: 'Hospital',
          status_until: 1_700_000_180,
          life_current: 75,
          last_action_relative: '1 day ago',
          last_attack_timestamp: 0,
          result: ''
        }
      },
      {
        id: '4',
        data: {
          name: 'Expired hospital',
          level: 50,
          status_state: 'Hospital',
          status_until: 1_699_999_900,
          life_current: 75,
          last_action_relative: '1 day ago',
          last_attack_timestamp: 0,
          result: ''
        }
      }
    ];

    component.sortBy('status');
    expect(component.sortedTargets.map(target => target.id)).toEqual(['2', '4', '3', '1']);

    component.sortBy('lastUpdate');
    expect(component.sortedTargets.map(target => target.id)).toEqual(['1', '2', '3', '4']);
  });

  it('sorts Fair Fight values numerically and keeps missing values last', () => {
    component.targets = [
      {
        id: '1',
        data: {
          name: 'Lower fair fight',
          level: 50,
          fair_fight: '1.2',
          last_action_relative: '1 day ago',
          last_attack_timestamp: 0,
          result: ''
        }
      },
      {
        id: '2',
        data: {
          name: 'Higher fair fight',
          level: 50,
          fair_fight: 2.5,
          last_action_relative: '1 day ago',
          last_attack_timestamp: 0,
          result: ''
        }
      },
      {
        id: '3',
        data: {
          name: 'Missing fair fight',
          level: 50,
          last_action_relative: '1 day ago',
          last_attack_timestamp: 0,
          result: ''
        }
      }
    ];

    component.sortBy('fairFight');
    expect(component.sortedTargets.map(target => target.id)).toEqual(['2', '1', '3']);

    component.sortBy('fairFight');
    expect(component.sortedTargets.map(target => target.id)).toEqual(['1', '2', '3']);
  });

  it('sorts Status by the same remaining seconds shown in hospital countdowns', () => {
    component.currentTime = 1_700_000_000_000;
    const nowSeconds = component.currentTime / 1000;
    const durations = [23 * 60, 15 * 60, 4 * 60, 21 * 60, 7 * 60, 10 * 60, 20 * 60,
      8 * 60, 19 * 60, 18 * 60, 7 * 60, 17 * 60, 13 * 60, 20 * 60, 1, 11 * 60, 12 * 60];
    component.targets = [
      {
        id: 'okay',
        data: {
          name: 'Okay',
          level: 50,
          status_state: 'Okay',
          last_action_relative: '1 day ago',
          last_attack_timestamp: 0,
          result: ''
        }
      },
      ...durations.map((seconds, index) => ({
        id: String(index),
        data: {
          name: `${seconds} seconds`,
          level: 50,
          status_state: 'Hospital',
          status_until: nowSeconds + seconds + 60,
          last_action_relative: '1 day ago',
          last_attack_timestamp: 0,
          result: ''
        }
      }))
    ];

    component.sortBy('status');

    const sorted = component.sortedTargets;
    expect(sorted[0].id).toBe('okay');
    expect(sorted.slice(1).map(target => Number(target.id))).toEqual([
      14, 2, 4, 10, 7, 5, 15, 16, 12, 1, 11, 9, 8, 6, 13, 3, 0
    ]);
    expect(sorted.slice(1).map(target => component.getHospitalCountdown(target))).toEqual([
      '0:00:01', '0:04:00', '0:07:00', '0:07:00', '0:08:00', '0:10:00',
      '0:11:00', '0:12:00', '0:13:00', '0:15:00', '0:17:00', '0:18:00',
      '0:19:00', '0:20:00', '0:20:00', '0:21:00', '0:23:00'
    ]);
  });

  it('sorts last-action durations numerically with the most recent first', () => {
    component.targets = [
      {
        id: '1',
        data: {
          name: 'Thirteen minutes',
          level: 50,
          last_action_relative: '13 mins ago',
          last_attack_timestamp: 0,
          result: ''
        }
      },
      {
        id: '2',
        data: {
          name: 'Fifty-two seconds',
          level: 50,
          last_action_relative: '52 secs ago',
          last_attack_timestamp: 0,
          result: ''
        }
      },
      {
        id: '3',
        data: {
          name: 'One minute',
          level: 50,
          last_action_relative: '1 min ago',
          last_attack_timestamp: 0,
          result: ''
        }
      },
      {
        id: '4',
        data: {
          name: 'One hour',
          level: 50,
          last_action_relative: '1 hour ago',
          last_attack_timestamp: 0,
          result: ''
        }
      },
      {
        id: '5',
        data: {
          name: 'Unknown age',
          level: 50,
          last_action_relative: 'Online',
          last_attack_timestamp: 0,
          result: ''
        }
      },
      {
        id: '6',
        data: {
          name: 'One minute and five seconds',
          level: 50,
          last_action_relative: '1 min 5 secs ago',
          last_attack_timestamp: 0,
          result: ''
        }
      },
      {
        id: '7',
        data: {
          name: 'One minute and fifty seconds',
          level: 50,
          last_action_relative: '1 min 50 secs ago',
          last_attack_timestamp: 0,
          result: ''
        }
      }
    ];

    expect(component.sortedTargets.map(target => target.id)).toEqual([
      '2', '3', '6', '7', '1', '4', '5'
    ]);

    component.sortBy('lastAction');
    expect(component.sortedTargets.map(target => target.id)).toEqual([
      '4', '1', '7', '6', '3', '2', '5'
    ]);
  });

  it('sorts the displayed last-action values numerically despite conflicting timestamps', () => {
    const durations = [
      '23 mins', '15 mins', '4 mins', '21 mins', '7 mins', '10 mins', '20 mins',
      '8 mins', '19 mins', '18 mins', '7 mins', '17 mins', '13 mins', '20 mins',
      '1 secs', '11 mins', '12 mins'
    ];
    component.targets = durations.map((duration, index) => ({
      id: String(index),
      data: {
        name: duration,
        level: 50,
        last_action_relative: duration,
        last_action_timestamp: 1_700_000_000 + index * 1000,
        last_attack_timestamp: 0,
        result: ''
      }
    }));

    expect(component.sortedTargets.map(target => target.data.last_action_relative)).toEqual([
      '1 secs', '4 mins', '7 mins', '7 mins', '8 mins', '10 mins', '11 mins',
      '12 mins', '13 mins', '15 mins', '17 mins', '18 mins', '19 mins',
      '20 mins', '20 mins', '21 mins', '23 mins'
    ]);
  });

  it('filters visible targets without changing the refresh target list', () => {
    component.targets = [
      {
        id: '12345',
        data: {
          name: 'Hospital target',
          level: 50,
          status_state: 'Hospital',
          last_action_relative: '1 day ago',
          last_attack_timestamp: 0,
          result: ''
        }
      },
      {
        id: '67890',
        data: {
          name: 'Okay target',
          level: 25,
          status_state: 'Okay',
          last_action_relative: '2 days ago',
          last_attack_timestamp: 0,
          result: ''
        }
      }
    ];
    component.isRefreshing = true;
    component.targetFilter = 'hospital';

    expect(component.filteredTargets.map(target => target.id)).toEqual(['12345']);
    expect(component.targets.map(target => target.id)).toEqual(['12345', '67890']);
  });

  it('counts down to the hospital status until timestamp', fakeAsync(() => {
    component.ngOnDestroy();
    component.currentTime = Date.now();
    const target = {
      id: '1',
      data: {
        name: 'Hospital target',
        level: 50,
        status_state: 'Hospital',
        status_until: Math.floor(component.currentTime / 1000) + 65,
        last_action_relative: '1 day ago',
        last_attack_timestamp: 0,
        result: ''
      }
    };

    expect(component.getHospitalCountdown(target)).toBe('0:00:05');
    component.ngOnInit();
    tick(1000);
    expect(component.getHospitalCountdown(target)).toBe('0:00:04');

    component.currentTime = (target.data.status_until as number) * 1000;
    expect(component.getHospitalCountdown(target)).toBe('Time reached — refresh to confirm');
    component.ngOnDestroy();
  }));

  it('applies Torn’s one-minute hospital countdown offset', () => {
    component.currentTime = 1_700_000_000_000;
    const target = {
      id: '1',
      data: {
        name: 'Hospital target',
        level: 50,
        status_state: 'Hospital',
        status_until: 1_700_000_270,
        last_action_relative: '1 day ago',
        last_attack_timestamp: 0,
        result: ''
      }
    };

    expect(component.getHospitalCountdown(target)).toBe('0:03:30');
  });

  it('refreshes targets in the sort order active when refresh starts', fakeAsync(() => {
    component.targets = [
      {
        id: '2',
        data: {
          name: 'Beta',
          level: 50,
          last_action_relative: '1 day ago',
          last_attack_timestamp: 0,
          result: ''
        }
      },
      {
        id: '1',
        data: {
          name: 'Alpha',
          level: 50,
          last_action_relative: '1 day ago',
          last_attack_timestamp: 0,
          result: ''
        }
      }
    ];
    component.sortBy('name');
    component.apiKey = 'personal-key';
    component.refreshTargets();

    const ownProfileRequest = httpMock.expectOne(
      request => request.url === 'https://api.torn.com/user/' &&
        request.params.get('selections') === 'basic'
    );
    ownProfileRequest.flush({ player_id: 555 });
    flushMicrotasks();
    const attacksRequest = httpMock.expectOne(
      request => request.url === 'https://api.torn.com/user/555' &&
        request.params.get('selections') === 'attacksfull'
    );
    attacksRequest.flush({ attacks: {} });
    flushMicrotasks();

    const firstRequest = httpMock.expectOne('https://api.torn.com/user/1?selections=basic&key=personal-key');
    firstRequest.flush({
      status: { state: 'Okay', description: 'Okay' },
      life: { current: 75, maximum: 100 }
    });
    flushMicrotasks();
    tick(1000);

    const secondRequest = httpMock.expectOne('https://api.torn.com/user/2?selections=basic&key=personal-key');
    secondRequest.flush({
      status: { state: 'Okay', description: 'Okay' },
      life: { current: 75, maximum: 100 }
    });
    flushMicrotasks();

    expect(component.refreshProgress).toBe(2);
    expect(component.targets.every(target => target.lastUpdatedAt !== undefined)).toBeTrue();
    expect(component.refreshMessage).toBe('Updated all 2 targets.');
  }));
});
