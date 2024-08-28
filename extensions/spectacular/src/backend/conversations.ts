import { Joule, Conversation } from "../types";
import * as vscode from "vscode";

export function create(): Conversation {
	return { joules: [] };
}

export function addJoule(
	conversation: Conversation,
	joule: Joule
): Conversation {
	return { joules: [...conversation.joules, joule] };
}

export function lastJoule(conversation: Conversation): Joule | undefined {
	return conversation.joules.length
		? conversation.joules[conversation.joules.length - 1]
		: undefined;
}

export function replaceLastJoule(
	conversation: Conversation,
	joule: Joule
): Conversation {
	if (conversation.joules.length === 0) {
		throw new Error("No joules to replace");
	}
	return { joules: [...conversation.joules.slice(0, -1), joule] };
}

/**
 * If there are two joules in a row from the same author, combine them into one
 * @param conversation
 */
function combineDoubleJoules(conversation: Conversation): Conversation {
	return {
		joules: conversation.joules.reduce((acc, joule, index, array) => {
			if (index === 0 || joule.author !== array[index - 1].author) {
				return [...acc, joule];
			} else {
				console.error("Combining double joules: ", joule, array[index - 1]);
				const lastJoule = acc[acc.length - 1];
				return [
					...acc.slice(0, -1),
					{
						...lastJoule, // use the info from the first joule
						message: `${lastJoule.message}\n\n${joule.message}`,
					},
				];
			}
		}, [] as Joule[]),
	};
}

function removeLeadingErrorJoules(conversation: Conversation): Conversation {
	if (conversation.joules.length === 0) {
		return conversation;
	}
	// get rid of initial error joules
	while (conversation.joules[0].state === "error") {
		console.log("Removing initial error joule");
		conversation = {
			joules: conversation.joules.slice(1),
		};
	}
	return conversation;
}

function removeLeadingBotJoules(conversation: Conversation): Conversation {
	if (conversation.joules.length === 0) {
		return conversation;
	}
	while (conversation.joules[0].author === "bot") {
		console.error("Unexpected: removing initial bot joule");
		conversation = {
			joules: conversation.joules.slice(1),
		};
	}
	return conversation;
}

/**
 * removes any joules needed to make the conversation ready for a response from the given author
 */
export function forceConversationReadyForResponseFrom(
	conversation: Conversation,
	author: "human" | "bot"
): Conversation {
	const processors = [
		(c: Conversation) => removeFinalJoulesFrom(c, author),
		removeLeadingErrorJoules,
		removeLeadingBotJoules,
		combineDoubleJoules,
	];
	return processors.reduce((c, p) => p(c), conversation);
}

function removeFinalJoulesFrom(
	conversation: Conversation,
	author: "human" | "bot"
): Conversation {
	const oppositeAuthor = author === "human" ? "bot" : "human";

	const indexOfLastNonMatchingJoule = conversation.joules.some(
		(joule) => joule.author === oppositeAuthor
	)
		? conversation.joules.length -
		1 -
		Array.from(conversation.joules)
			.reverse()
			.findIndex((joule) => joule.author === oppositeAuthor)
		: -1; // no matching joules

	if (indexOfLastNonMatchingJoule === conversation.joules.length - 1) {
		// no changes needed!
		return conversation;
	} else {
		vscode.window.showInformationMessage(
			`Melty is force-removing ${oppositeAuthor} joules to prepare for a response from ${author}`
		);
		return {
			joules: conversation.joules.slice(0, indexOfLastNonMatchingJoule + 1),
		};
	}
}