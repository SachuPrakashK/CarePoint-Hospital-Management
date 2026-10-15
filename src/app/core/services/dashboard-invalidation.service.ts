import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
export type DashboardDomain='patient'|'appointment'|'inpatient'|'laboratory'|'radiology'|'pharmacy'|'inventory'|'billing'|'insurance'|'ambulance'|'operations';
@Injectable({providedIn:'root'}) export class DashboardInvalidationService{
 private state=new Subject<ReadonlySet<DashboardDomain>>();readonly changed=this.state.asObservable();
 invalidate(...domains:DashboardDomain[]){if(domains.length)this.state.next(new Set(domains));}
}
