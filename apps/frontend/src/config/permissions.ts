
export const PERMISSION = {
  MANAGE_CITY:         'manage:city',
  ZONING_READ:         'zoning:read',
  ZONING_WRITE:        'zoning:write',
  HAZARD_READ:         'hazard:read',
  HAZARD_WRITE:        'hazard:write',
  ESTABLISHMENT_READ:  'establishment:read',
  ESTABLISHMENT_WRITE: 'establishment:write',
  ALERTS_READ:         'alert:read',
  ALERTS_WRITE:        'alert:write',
  ANALYTICS_VIEW:      'analytics:view',
  LOCATION_SAVE:       'location:save',
  MANAGE_USER:         'manage:user',
  MANAGE_ROLE:         'manage:role',
  VIEW_MAP:            'view:map',
  MANAGE_SUBSCRIPTION: 'manage:subscription',
  MANAGE_LOGS:         'manage:logs',
} as const

export type Permission = (typeof PERMISSION)[keyof typeof PERMISSION]


