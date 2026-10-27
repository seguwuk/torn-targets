import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';

import { TargetComponent } from './target.component';

describe('TargetComponent', () => {
  let component: TargetComponent;
  let fixture: ComponentFixture<TargetComponent>;
  let httpMock: HttpTestingController;

  beforeEach(() => {
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
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('refreshes target status and health using the entered API key', async () => {
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

    const refresh = component.refreshTargets();
    const request = httpMock.expectOne(
      request => request.url === 'https://api.torn.com/user/12345'
    );
    expect(request.request.params.get('selections')).toBe('basic');
    expect(request.request.params.get('key')).toBe('personal-key');
    request.flush({
      status: { state: 'Okay', description: 'Okay' },
      life: { current: 75, maximum: 100 }
    });

    await refresh;

    expect(component.targets[0].data.status_state).toBe('Okay');
    expect(component.targets[0].data.status_description).toBe('Okay');
    expect(component.targets[0].data.life_current).toBe(75);
    expect(component.targets[0].data.life_maximum).toBe(100);
    expect(component.apiKey).toBe('');
  });
});
