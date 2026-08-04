import { API } from '@opencode/shared';
import { request } from './client';
export function register(body) {
    return request(API.auth.register.path, { method: 'POST', body });
}
export function login(body) {
    return request(API.auth.login.path, { method: 'POST', body });
}
export function getMe() {
    return request(API.auth.me.path);
}
