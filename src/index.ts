/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
	CompanionVariableValues,
	InstanceBase,
	InstanceStatus,
	runEntrypoint,
	SomeCompanionConfigField,
} from '@companion-module/base'
import { GetConfigFields, ModuleConfig } from './config'
import { GetPresetsList } from './presets'
import { CustomMessageFeedbacks, FeedbackBindings, FeedbackId, GetFeedbacksList } from './feedbacks'
import { GetActionsList } from './actions'
import { LogLevel, OscMessage, Reaper, ReaperConfiguration } from 'reaper-osc'
import { GetMarkerVariableDefinitions, GetVariableDefinitions, ReaperProperty } from './variables'
import {
	CreateNumberOfMarkersDefaultUpgradeScript,
	CreateNumberOfTracksDefaultsUpgradeScript,
	CreateUseInvertForFeedbacksUpgradeScript,
} from './upgrades'
import { DefaultNumberOfMarkers, MarkerCountMessages, MarkerState } from './markers'

class ControllerInstance extends InstanceBase<ModuleConfig> {
	private _reaper: Reaper | null
	private _unsubscribeVariables: Unsubscribe[] = []
	private _feedbackBindings: FeedbackBindings = {}
	private _customMessageFeedbacks: CustomMessageFeedbacks = {}
	private _markers: MarkerState = new MarkerState(0, () => undefined)

	constructor(internal: unknown) {
		super(internal)

		this._reaper = null
	}

	public async init(config: ModuleConfig): Promise<void> {
		await this.configUpdated(config)

		this.setActionDefinitions(
			GetActionsList(() => ({
				reaper: this._reaper!,
				markers: this._markers,
				log: (level, message) => this.log(level, message),
			}))
		)

		this.setFeedbackDefinitions(
			GetFeedbacksList(() => ({
				reaper: this._reaper!,
				markers: this._markers,
				log: (level, message) => this.log(level, message),
				checkFeedback: (feedbackId) => this.checkFeedbacksById(feedbackId),
				bindings: this._feedbackBindings,
				customMessageFeedbacks: this._customMessageFeedbacks,
			}))
		)
	}

	public async configUpdated(config: ModuleConfig): Promise<void> {
		if (this._reaper !== null) {
			await this.disconnectOsc()
			this.unbindVariables()
			this.unsubscribeFeedbacks()
		}

		const reaperConfig = new ReaperConfiguration()

		// Listener
		reaperConfig.localAddress = '0.0.0.0'
		reaperConfig.localPort = config.feedbackPort

		// Reaper
		reaperConfig.remoteAddress = config.host
		reaperConfig.remotePort = config.port

		// Device Setup
		reaperConfig.numberOfTracks = config.numberOfTracks
		reaperConfig.numberOfFx = config.numberOfFx

		reaperConfig.afterMessageReceived = (message, handled) => {
			this.handleCustomMessages(message, handled)
		}

		this._reaper = new Reaper(reaperConfig)

		const numberOfMarkers = config.numberOfMarkers ?? DefaultNumberOfMarkers

		this._markers = new MarkerState(numberOfMarkers, (values) => {
			this.setVariableValues(values)
			this.checkFeedbacks(FeedbackId.MarkerSlotCurrent)
		})

		this.bindVariables(config.numberOfTracks, config.numberOfFx, numberOfMarkers)
		this.subscribeFeedbacks()
		this.checkFeedbacks(FeedbackId.MarkerSlotCurrent)
		this.setPresetDefinitions(GetPresetsList(numberOfMarkers))

		this.log('debug', `Reaper Configuration: ${JSON.stringify(reaperConfig, null, 2)}`)

		if (!(await this.connectOsc())) {
			return
		}

		if (numberOfMarkers > 0) {
			// Tell Reaper how many markers to send us (DEVICE_MARKER_COUNT). This needs to go before the refresh.
			MarkerCountMessages(numberOfMarkers).forEach((message) => this._reaper?.sendOscMessage(message))
		}

		if (config.refreshOnInit) {
			this.log('info', 'Refreshing OSC values')
			this._reaper.refreshControlSurfaces()
		}
	}

	public getConfigFields(): SomeCompanionConfigField[] {
		return GetConfigFields()
	}

	public async destroy(): Promise<void> {
		await this.disconnectOsc()
		this.unbindVariables()
		this.unsubscribeFeedbacks()
	}

	private handleCustomMessages(message: OscMessage, _: boolean) {
		this.log('debug', `OSC Message received: ${JSON.stringify(message)}`)

		Object.values(this._customMessageFeedbacks).forEach((feedback) => {
			feedback.handler.handle(message)
		})

		try {
			this._markers.handle(message)
		} catch (err) {
			this.log('debug', `Failed to handle marker message ${message.address}: ${err}`)
		}
	}

	private async connectOsc(): Promise<boolean> {
		if (this._reaper === null) {
			this.log('error', 'Reaper is not configured')
			return false
		}

		this.updateStatus(InstanceStatus.Connecting)

		try {
			await this._reaper.start()
		} catch (err) {
			this.log('error', `Failed to connect: ${JSON.stringify(err)}`)
			this.updateStatus(InstanceStatus.ConnectionFailure)
			return false
		}

		this.updateStatus(InstanceStatus.Ok)
		return true
	}

	private async disconnectOsc() {
		if (this._reaper === null) {
			return
		}

		await this._reaper.stop()
		this.updateStatus(InstanceStatus.Disconnected)
		this.log('info', 'Stopped listening to Reaper')
	}

	private bindVariables(numberOfTracks: number, numberOfFx: number, numberOfMarkers: number): void {
		const variables = GetVariableDefinitions(numberOfTracks, numberOfFx)

		const unsubscribes: Unsubscribe[] = []

		this.setVariableDefinitions([...variables, ...GetMarkerVariableDefinitions(numberOfMarkers)])

		// Marker variables are not backed by reaper-osc properties - they are updated by MarkerState
		const variableValues: CompanionVariableValues = this._markers.getVariableValues()

		variables.forEach((variable) => {
			const property = variable.getProperty(this._reaper!)

			// Bind the variable to the property
			const unsub = property.item.onPropertyChanged(property.property, () => {
				this.setVariableValues({
					[variable.variableId]: this.getCurrentVariableValue(property, variable.valueConverter),
				})
			})

			unsubscribes.push(unsub)

			// Set initial value
			variableValues[variable.variableId] = this.getCurrentVariableValue(property, variable.valueConverter)
		})

		this.setVariableValues(variableValues)

		this._unsubscribeVariables = unsubscribes
	}

	private unbindVariables(): void {
		const unsubscribes = this._unsubscribeVariables
		this._unsubscribeVariables = []

		unsubscribes.forEach((element) => {
			element()
		})
	}

	private getCurrentVariableValue(property: ReaperProperty, valueConverter?: (value: any) => any) {
		let value = property.valueSelector(property.item)

		if (valueConverter) {
			value = valueConverter(value)
		}

		return value
	}
}

export interface ModuleContext {
	readonly reaper: Reaper
	readonly markers: MarkerState
	readonly log: (level: LogLevel, message: string) => void
}

type Unsubscribe = () => void

runEntrypoint(ControllerInstance, [
	CreateUseInvertForFeedbacksUpgradeScript({
		[FeedbackId.PlayStatus]: { optionId: 'playPause', trueValue: 'Playing' },
		[FeedbackId.StopStatus]: { optionId: 'stopPlay', trueValue: 'Stopped' },
		[FeedbackId.RecordStatus]: { optionId: 'recordOrNot', trueValue: 'Recording' },
		[FeedbackId.RewindStatus]: { optionId: 'rewindOrNot', trueValue: 'Rewinding' },
		[FeedbackId.ForwardStatus]: { optionId: 'forwardOrNot', trueValue: 'Forwarding' },
		[FeedbackId.RepeatStatus]: { optionId: 'repeatOrNot', trueValue: 'Active' },
		[FeedbackId.ClickStatus]: { optionId: 'clickOrNot', trueValue: 'Active' },
	}),
	CreateNumberOfTracksDefaultsUpgradeScript(),
	CreateNumberOfMarkersDefaultUpgradeScript(),
])
