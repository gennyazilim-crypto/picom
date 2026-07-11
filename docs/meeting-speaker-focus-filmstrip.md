# Speaker focus and participant filmstrip

Picom's speaker layout uses a 650 ms candidate debounce and a 1600 ms silence
hold before changing automatic focus. Routine participant/store updates that do
not change the speaking set do not restart the decision. A manual pin uses the
canonical meeting focus field and always overrides automatic speaker changes
until the user clears it or the participant leaves.

The focused participant receives the large camera/avatar stage. A seven-person
filmstrip page shows camera/avatar media, speaking, microphone, hand, role, and
approved verification state. Previous/Next controls expose larger rooms without
shrinking tiles. The visible focus and filmstrip page reuse the typed adaptive
video subscription plan from Task 547.
