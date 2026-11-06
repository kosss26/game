import { BOT_COMMANDS, BOT_DESCRIPTION, BOT_SHORT_DESCRIPTION, HELP_MESSAGE, welcomeMessage } from "../messages";

describe("release bot copy", () => {
  test("descriptions fit Telegram limits and commands are unique", () => {
    expect(BOT_SHORT_DESCRIPTION.length).toBeLessThanOrEqual(120);
    expect(BOT_DESCRIPTION.length).toBeLessThanOrEqual(512);
    expect(new Set(BOT_COMMANDS.map(command => command.command)).size).toBe(BOT_COMMANDS.length);
    expect(BOT_COMMANDS.map(command => command.command)).toEqual(expect.arrayContaining(["start", "support", "paysupport", "help", "terms"]));
  });
  test("welcome escapes user input and handles an empty catalog", () => {
    const message = welcomeMessage("<b>Аня & Катя</b>", true);
    expect(message).toContain("&lt;b&gt;Аня &amp; Катя&lt;/b&gt;");
    expect(message).not.toContain("живые персонажи");
    expect(message.length).toBeLessThan(800);
    expect(welcomeMessage("Аня", false)).not.toContain("историю ниже");
    expect(HELP_MESSAGE).toContain("/support");
  });
});
