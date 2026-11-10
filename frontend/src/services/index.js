/**
 * Barrel export cho toàn bộ services trong hệ thống
 * Cho phép import linh hoạt:
 * import { roomService, bookingService, hotelService } from '@/services';
 */

export { default as api } from './api';
export * from './adminUserService';
export * from './amenityService';
export * from './auditLogService';
export * from './authService';
export * from './bookingService';
export * from './chatbotService';
export * from './contactService';
export * from './hotelService';
export * from './notificationService';
export * from './paymentService';
export * from './postService';
export * from './promotionService';
export * from './reportService';
export * from './reviewService';
export * from './roomService';

