import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() {
    return {
      status: 'healthy',
      platform: 'CivicConnect Health & Emergency Assistance API',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      modules: [
        'Authentication (RBAC 8 Roles)',
        'Hospitals & Live ICU/General Bed Capacity',
        'Blood Banks (8 Blood Groups Inventory)',
        'Pharmacies & Medicine Proximity Search',
        'Ambulance Dispatch & Fleet Management',
        'Government Health Schemes Directory',
        'Citizen Grievance / Complaints Tracking',
        'Emergency Public Health Alerts Broadcast',
        'AI Health Informational Assistant',
        'Admin Governance & KYC Verification',
      ],
    };
  }
}
