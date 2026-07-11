import { meetingParticipantTileFixtures } from "../../data/meetingParticipantTileFixtures";
import { MeetingParticipantTile } from "./MeetingParticipantTile";

export function MeetingParticipantTileFixtures() {
  return <section aria-label="Meeting participant tile visual fixtures" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(240px, 1fr))", gap: 12, padding: 16 }}>{meetingParticipantTileFixtures.map((fixture) => <article key={fixture.id}><h2>{fixture.title}</h2><MeetingParticipantTile participant={fixture.participant} variant={fixture.variant} selected={fixture.selected} focused={fixture.focused} /></article>)}</section>;
}
