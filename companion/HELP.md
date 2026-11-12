## Cockos Reaper

This module connects to the Cockos Reaper software.

### Configuration

- In Companion's Reaper module settings:

  - Type in the IP address of the computer running Reaper.
  - Under **Target port**, type in the port that Reaper is listening for OSC messages on.
  - Under **Feedback port**, type in the port that Reaper is sending OSC messages to.
  - Under **Marker Slots**, set how many markers you want to show at once (see [Markers](#markers)).

- In Reaper's preferences:
  - Go to **Control/OSC/web**:
  - Add a device
  - Set the **Control surface mode** to **OSC**
  - Set **Mode** to **Configure device IP+local port**
  - Set **Device IP** to companion's IP address.
  - Set **Device port** to the **Feedback port**.
  - Set **Local listen port** to the **Target port**.

### Markers

Reaper can tell Companion the names of the markers in the project. Markers are shown in _slots_: with 10 **Marker Slots**, slot 1 to 10 hold the first 10 markers of the project in timeline order. Use the **Marker Bank Next** and **Marker Bank Previous** actions to page through the rest of the markers.

- The number of marker slots is sent to Reaper when the module starts and when the **Refresh OSC** action is used. If Reaper is restarted while Companion is running, use **Refresh OSC** to get the markers back. Set **Marker Slots** to 0 to leave the marker count configured in Reaper untouched.
- **Go To Marker Slot** goes to the marker that is currently in a slot. **Go To Marker** goes to a marker by its ID (the number shown in Reaper), regardless of the slot it is in.
- The **Marker Slot Is Current Marker** feedback is active when the marker in a slot is the last marker passed by the play cursor (or the edit cursor when stopped).
- The pattern config of the OSC device in Reaper needs to contain the `MARKER_NAME`, `MARKER_NUMBER`, `LAST_MARKER_NAME`, `LAST_MARKER_NUMBER`, `DEVICE_MARKER_COUNT`, `DEVICE_PREV_MARKER_BANK` and `DEVICE_NEXT_MARKER_BANK` patterns. This is the case for the `Default` pattern config.

### Available variables

- Transport status, time, beat and frames
- Track name, mute, solo, record arm, selected, monitoring, volume and pan
- Track FX name, bypass and UI open
- `marker_<slot>_name` and `marker_<slot>_number`: the name and ID of the marker in a marker slot
- `last_marker_name` and `last_marker_number`: the name and ID of the last marker passed by the play/edit cursor

### Available actions

- Record
- Play
- Stop
- Pause
- Autoarm Record
- Reset Solos
- Rewind (Start)
- Rewind (Stop)
- Forward (Start)
- Forward (Stop)
- Click/Metronome
- Go To Marker
- Go To Marker Slot
- Marker Bank Next
- Marker Bank Previous
- Go To Region
- Track Mute
- Track Solo
- Track Arm
- Track Unmute
- Track Unsolo
- Track Unarm
- Track Mute (toggle)
- Track Solo (toggle)
- Track Arm (toggle)
- Track Select
- Track Deselect
- Track Monitoring Enable
- Track Monitoring Disable
- Track Set Volume (dB)
- Track Set Volume (fader position)
- Track Volume Up
- Track Volume Down
- Track Volume Fade
- Track Set Pan
- Track Set Pan 2
- Track FX Bypass
- Track FX Open UI
- Track FX Unbypass
- Track FX Close UI
- Custom Action

### Available feedbacks

Feedbacks are available to reflect the state of the following actions:

- Play
- Stop
- Record
- Rewind
- Forward
- Repeat
- Click/Metronome
- Marker Slot Is Current Marker
- Track Mute
- Track Solo
- Track Arm
- Track Monitoring
- Track Selected
- Track FX Active
- Track FX UI Open
- Custom feedback based on an OSC message and its value

### Available presets

All presets include feedback for their respective actions.

- Play
- Stop
- Record
- Rewind (Start and Stop combined)
- Forward (Start and Stop combined)
- Repeat
- Click/Metronome
- Go To Marker Slot, for each marker slot, showing the name of the marker
- Marker Bank Next and Marker Bank Previous
- Last Marker Name
