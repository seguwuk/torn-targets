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
          timestamp_ended: 1234567000
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
    expect(component.targets[0].data.last_action_relative).toBe('5 minutes ago');
    expect(component.targets[0].data.last_action_timestamp).toBe(1234567890);
    expect(component.targets[0].data.last_attack_timestamp).toBe(1234567000);
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

  it('sorts targets by status and last update', () => {
    component.targets = [
      {
        id: '1',
        data: {
          name: 'First',
          level: 50,
          status_state: 'Hospital',
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
      }
    ];

    component.sortBy('status');
    expect(component.sortedTargets.map(target => target.id)).toEqual(['1', '2']);

    component.sortBy('lastUpdate');
    expect(component.sortedTargets.map(target => target.id)).toEqual(['1', '2']);
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
