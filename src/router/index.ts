import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'dashboard',
    component: () => import('@/views/DashboardView.vue'),
    meta: { title: '仪表盘', icon: 'dashboard' },
  },
  {
    path: '/device/:id',
    name: 'device-detail',
    component: () => import('@/views/DeviceDetailView.vue'),
    meta: { title: '设备详情', icon: 'device' },
  },
  {
    path: '/tasks',
    name: 'tasks',
    component: () => import('@/views/TaskListView.vue'),
    meta: { title: '任务列表', icon: 'tasks' },
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
