import { telegramRequest } from '../transport';

describe('Telegram transport', () => {
  const original = global.fetch;
  afterEach(() => { global.fetch = original; });
  test('direct mode never sends a relay secret to Telegram', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok:true }); global.fetch=fetchMock;
    await telegramRequest('getMe', {}, { token:'111:fixture', relaySecret:'private-relay' });
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.telegram.org/bot111:fixture/getMe');
    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty('X-Relay-Secret');
  });
  test('relay mode preserves the method, token, payload and separate authentication', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok:true }); global.fetch=fetchMock;
    for (const method of ['getMe','setWebhook','sendMessage','createInvoiceLink','answerPreCheckoutQuery']) {
      await telegramRequest(method,{fixture:method},{token:'222:fixture',apiBase:'https://relay.invalid/',relaySecret:'new-secret'});
      const [url,options]=fetchMock.mock.calls.at(-1)!;
      expect(url).toBe(`https://relay.invalid/bot222:fixture/${method}`);
      expect(options.headers['X-Relay-Secret']).toBe('new-secret');
      expect(JSON.parse(options.body)).toEqual({fixture:method});
      expect(options.redirect).toBe('error');
      expect(options.signal).toBeDefined();
    }
  });
  test('missing relay secret or invalid URLs cannot make a request', () => {
    const fetchMock=jest.fn();global.fetch=fetchMock;
    const options={token:'222:fixture',relaySecret:'new-secret'};
    expect(()=>telegramRequest('getMe',{}, {...options,apiBase:'https://relay.invalid',relaySecret:''})).toThrow('TELEGRAM_RELAY_SECRET');
    for(const apiBase of ['http://relay.invalid','https://user:pass@relay.invalid','https://relay.invalid?key=x']) {
      expect(()=>telegramRequest('getMe',{}, {...options,apiBase})).toThrow();
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
