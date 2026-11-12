import { CompanionStaticUpgradeResult, CompanionStaticUpgradeScript } from '@companion-module/base'
import { ModuleConfig } from './config'
import { DefaultNumberOfMarkers } from './markers'

export function CreateUseInvertForFeedbacksUpgradeScript(
	upgradeMap: Record<string, BooleanFeedbackOption>
): CompanionStaticUpgradeScript<ModuleConfig> {
	return (_, props) => {
		const changedFeedbacks: CompanionStaticUpgradeResult<unknown>['updatedFeedbacks'] = []

		for (const feedback of props.feedbacks) {
			const option = upgradeMap[feedback.feedbackId]

			if (option === undefined) {
				continue
			}

			const currentValue = feedback.options[option.optionId]

			if (currentValue === undefined) {
				continue
			}

			delete feedback.options[option.optionId]

			feedback.isInverted = currentValue !== option.trueValue

			changedFeedbacks.push(feedback)
		}

		return {
			updatedConfig: null,
			updatedActions: [],
			updatedFeedbacks: changedFeedbacks,
		}
	}
}

export function CreateNumberOfTracksDefaultsUpgradeScript(): CompanionStaticUpgradeScript<ModuleConfig> {
	return (_, props) => {
		const { config } = props
		if (config) {
			config.numberOfTracks ??= 8
			config.numberOfFx ??= 8
		}

		return {
			updatedConfig: config,
			updatedActions: [],
			updatedFeedbacks: [],
		}
	}
}

export function CreateNumberOfMarkersDefaultUpgradeScript(): CompanionStaticUpgradeScript<ModuleConfig> {
	return (_, props) => {
		const { config } = props
		if (config) {
			config.numberOfMarkers ??= DefaultNumberOfMarkers
		}

		return {
			updatedConfig: config,
			updatedActions: [],
			updatedFeedbacks: [],
		}
	}
}

export type BooleanFeedbackOption = {
	optionId: string
	trueValue: string
}
