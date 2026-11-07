/** @jest-environment node */
import { POST } from '@/app/api/startup/route';

const send = (data: object) => POST(new Request('https://app.invalid/api/startup', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data),
}));

test('logs only allowlisted diagnostic fields, excluding supplied user data', async () => {
  const log = jest.spyOn(console, 'info').mockImplementation(() => {});
  try {
    expect((await send({ id: 'abcdef12-3456', phase: 'document', elapsed: 10, bridge: true, token: 'PRIVATE', url: '#SECRET' })).status).toBe(204);
    expect(log).toHaveBeenCalledWith('[polnoch-startup]', JSON.stringify({id: 'abcdef12-3456',phase: 'document',bridge: true,elapsed: 10}));
  } finally { log.mockRestore(); }
});
test('rejects unknown phase and oversized bodies', async () => {
  expect((await send({id:'abcdef12',phase:'unknown'})).status).toBe(400);
  expect((await send({id:'abcdef12',phase:'document',extra:'x'.repeat(600)})).status).toBe(413);
});
