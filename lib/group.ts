import type { Bot, Group, Msg } from "./bots";

type ApiMsg = { role: "user" | "assistant"; content: string };

// Bots named with @Name answer; with no mentions, every member answers in order.
export function pickSpeakers(text: string, members: Bot[]): Bot[] {
  const lower = text.toLowerCase();
  const mentioned = members.filter((b) => lower.includes(`@${b.name.toLowerCase()}`));
  return mentioned.length ? mentioned : members;
}

export function groupSystemPrompt(speaker: Bot, group: Group, members: Bot[]) {
  const others = members
    .filter((b) => b.id !== speaker.id)
    .map((b) => (b.title ? `${b.name} (${b.title})` : b.name))
    .join(", ");
  return [
    speaker.instructions,
    "",
    "---",
    `You are "${speaker.name}" in a group chat called "${group.name}" with the user and these other Bots: ${others}.`,
    'Messages from other Bots appear as "[Name]: ...".',
    `Reply only as ${speaker.name}, without a name prefix. Add your own angle and don't repeat what others already said.`,
    "Keep it brief unless asked for detail. If the message isn't meant for you or you have nothing useful to add, reply with one short line.",
  ].join("\n");
}

// One shared transcript, re-voiced for each speaker: its own turns are "assistant",
// everyone else's Bot turns become labeled user turns.
export function groupHistory(speaker: Bot, transcript: Msg[], bots: Bot[]): ApiMsg[] {
  const out: ApiMsg[] = [];
  for (const m of transcript) {
    if (m.error || !m.content) continue;
    let next: ApiMsg;
    if (m.role === "user") next = { role: "user", content: m.content };
    else if (m.botId === speaker.id) next = { role: "assistant", content: m.content };
    else {
      const name = bots.find((b) => b.id === m.botId)?.name ?? "Deleted Bot";
      next = { role: "user", content: `[${name}]: ${m.content}` };
    }
    // Some providers reject back-to-back turns with the same role, so merge them
    const last = out[out.length - 1];
    if (last && last.role === next.role) last.content += `\n\n${next.content}`;
    else out.push(next);
  }
  return out;
}
