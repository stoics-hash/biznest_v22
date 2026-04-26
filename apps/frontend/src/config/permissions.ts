
export const PERMISSION = {
 CITY_VIEW: 'city:view',
    ZONING_READ:  'zoning:read',
    ZONING_WRITE: 'zoning:write',
    HAZARD_READ: 'hazard:read',
    HAZARD_WRITE: 'hazard:write',
    ESTABLISHMENT_READ: 'establishment:read',
    ESTABLISHMENT_WRITE: 'establishment:write',
    ALERTS_READ: 'alert:read',
    ALERTS_WRITE: 'alert:write',
    ANALYTICS_VIEW: 'analytics:view'
}

export type Permission = keyof typeof PERMISSION