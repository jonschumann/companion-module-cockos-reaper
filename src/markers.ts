import { CompanionVariableValues } from '@companion-module/base'
import { IMessageHandler, IntegerMessage, OscMessage, StringMessageHandler } from 'reaper-osc'
import { LastMarkerVariableId, MarkerSlotVariableId } from './variables'

export const DefaultNumberOfMarkers = 10
export const MaxNumberOfMarkers = 512

export type MarkerSlot = {
	/** The name of the marker in this slot. Empty if the marker is unnamed or the slot is empty */
	name: string
	/** The ID ("number") of the marker in this slot, as displayed in Reaper. Empty if the slot is empty */
	number: string
}

/**
 * Tracks the markers Reaper reports for the current marker bank (MARKER_NAME / MARKER_NUMBER) and the
 * last marker passed by the play/edit cursor (LAST_MARKER_NAME / LAST_MARKER_NUMBER).
 *
 * reaper-osc does not support markers yet, so these are picked up from the raw OSC messages.
 */
export class MarkerState {
	private readonly _slots: MarkerSlot[] = []
	private readonly _handlers: IMessageHandler[] = []
	private _lastMarkerName = ''
	private _lastMarkerNumber = ''

	/**
	 * @param numberOfSlots The number of markers per bank
	 * @param onChanged Called with the new variable values whenever Reaper reports a change
	 */
	constructor(numberOfSlots: number, private readonly onChanged: (values: CompanionVariableValues) => void) {
		for (let i = 0; i < numberOfSlots; i++) {
			const slot: MarkerSlot = { name: '', number: '' }
			const slotNumber = i + 1

			this._slots.push(slot)

			this._handlers.push(
				new StringMessageHandler(`/marker/${slotNumber}/name`, (value) => {
					this.update(slot.name, value, MarkerSlotVariableId(slotNumber, 'name'), (v) => (slot.name = v))
				}),
				new StringMessageHandler(`/marker/${slotNumber}/number/str`, (value) => {
					this.update(slot.number, value, MarkerSlotVariableId(slotNumber, 'number'), (v) => (slot.number = v))
				})
			)
		}

		this._handlers.push(
			new StringMessageHandler('/lastmarker/name', (value) => {
				this.update(this._lastMarkerName, value, LastMarkerVariableId('name'), (v) => (this._lastMarkerName = v))
			}),
			new StringMessageHandler('/lastmarker/number/str', (value) => {
				this.update(this._lastMarkerNumber, value, LastMarkerVariableId('number'), (v) => (this._lastMarkerNumber = v))
			})
		)
	}

	/** The number of markers per bank */
	public get numberOfSlots(): number {
		return this._slots.length
	}

	public get lastMarkerName(): string {
		return this._lastMarkerName
	}

	public get lastMarkerNumber(): string {
		return this._lastMarkerNumber
	}

	/**
	 * Get a slot in the current marker bank
	 * @param slotNumber The slot number, starting from 1
	 */
	public getSlot(slotNumber: number): MarkerSlot | undefined {
		return this._slots[slotNumber - 1]
	}

	/** Indicates whether the marker in a slot is the last marker passed by the play/edit cursor */
	public isSlotCurrent(slotNumber: number): boolean {
		const slot = this.getSlot(slotNumber)

		return slot !== undefined && slot.number !== '' && slot.number === this._lastMarkerNumber
	}

	/** The current value of every marker variable */
	public getVariableValues(): CompanionVariableValues {
		const values: CompanionVariableValues = {
			[LastMarkerVariableId('name')]: this._lastMarkerName,
			[LastMarkerVariableId('number')]: this._lastMarkerNumber,
		}

		this._slots.forEach((slot, i) => {
			values[MarkerSlotVariableId(i + 1, 'name')] = slot.name
			values[MarkerSlotVariableId(i + 1, 'number')] = slot.number
		})

		return values
	}

	/**
	 * Handle an OSC message from Reaper
	 * @returns True if the message was a marker message
	 */
	public handle(message: OscMessage): boolean {
		const root = message.addressParts[0]

		if (root !== 'marker' && root !== 'lastmarker') {
			return false
		}

		for (const handler of this._handlers) {
			if (handler.handle(message)) {
				return true
			}
		}

		return false
	}

	private update(current: string, value: string, variableId: string, set: (value: string) => void): void {
		if (current === value) {
			return
		}

		set(value)
		this.onChanged({ [variableId]: value })
	}
}

/**
 * Tells Reaper how many markers this device wants information for (DEVICE_MARKER_COUNT).
 *
 * Reaper only sends values that changed since it last sent them to this device, so asking for the same count
 * again (e.g. when the module restarts) would not get us the markers. Resetting the count first makes Reaper
 * send every slot again. The selected marker bank is not affected.
 */
export function MarkerCountMessages(numberOfMarkers: number): OscMessage[] {
	return [new IntegerMessage('/device/marker/count', 0), new IntegerMessage('/device/marker/count', numberOfMarkers)]
}

/** Selects the next/previous bank of markers (DEVICE_NEXT_MARKER_BANK / DEVICE_PREV_MARKER_BANK) */
export function MarkerBankMessage(direction: 'next' | 'previous'): OscMessage {
	return new OscMessage(`/device/marker/bank/${direction === 'next' ? '+' : '-'}`)
}

/**
 * Goes to the marker in a slot of the current marker bank (GOTO_MARKER).
 *
 * Reaper counts the number in the address from the first marker of the current bank, in timeline order. It is
 * not the ID of the marker.
 */
export function GotoMarkerSlotMessage(slotNumber: number): OscMessage {
	return new OscMessage(`/marker/${slotNumber}`)
}
