import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 100,
  duration: '10s',
  thresholds: {
    http_req_duration: ['p(95)<200'], // p95 response time < 200ms
  },
};

export default function () {
  const res = http.get('http://localhost:8000/api/status');
  check(res, {
    'status is 200': (r) => r.status === 200,
  });
  sleep(0.1);
}
