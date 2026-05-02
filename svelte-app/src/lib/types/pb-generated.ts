/**
* This file was @generated using pocketbase-typegen
*/

import type PocketBase from 'pocketbase'
import type { RecordService } from 'pocketbase'

export const Collections = {
	Authorigins: "_authOrigins",
	Externalauths: "_externalAuths",
	Mfas: "_mfas",
	Otps: "_otps",
	Superusers: "_superusers",
	EventMateriel: "event_materiel",
	EventTodos: "event_todos",
	Events: "events",
	Locks: "locks",
	Materiel: "materiel",
	MaterielLoan: "materiel_loan",
	Notifications: "notifications",
	Products: "products",
	Purchases: "purchases",
	Recipes: "recipes",
	ShareLinks: "share_links",
	Teamdocs: "teamdocs",
	Teams: "teams",
	Users: "users",
} as const
export type Collections = typeof Collections[keyof typeof Collections]

// Alias types for improved usability
export type IsoDateString = string
export type IsoAutoDateString = string & { readonly autodate: unique symbol }
export type RecordIdString = string
export type FileNameString = string & { readonly filename: unique symbol }
export type HTMLString = string

type ExpandType<T> = unknown extends T
	? T extends unknown
		? { expand?: unknown }
		: { expand: T }
	: { expand: T }

// System fields
export type BaseSystemFields<T = unknown> = {
	id: RecordIdString
	collectionId: string
	collectionName: Collections
} & ExpandType<T>

export type AuthSystemFields<T = unknown> = {
	email: string
	emailVisibility: boolean
	username: string
	verified: boolean
} & BaseSystemFields<T>

// Record types for each collection

export type AuthoriginsRecord = {
	collectionRef: string
	created: IsoAutoDateString
	fingerprint: string
	id: string
	recordRef: string
	updated: IsoAutoDateString
}

export type ExternalauthsRecord = {
	collectionRef: string
	created: IsoAutoDateString
	id: string
	provider: string
	providerId: string
	recordRef: string
	updated: IsoAutoDateString
}

export type MfasRecord = {
	collectionRef: string
	created: IsoAutoDateString
	id: string
	method: string
	recordRef: string
	updated: IsoAutoDateString
}

export type OtpsRecord = {
	collectionRef: string
	created: IsoAutoDateString
	id: string
	password: string
	recordRef: string
	sentTo?: string
	updated: IsoAutoDateString
}

export type SuperusersRecord = {
	created: IsoAutoDateString
	email: string
	emailVisibility?: boolean
	id: string
	password: string
	tokenKey: string
	updated: IsoAutoDateString
	verified?: boolean
}

export type EventMaterielRecord<Tspecs = unknown> = {
	deleted?: boolean
	eventId: RecordIdString
	groupId?: string
	id: string
	specs?: null | Tspecs
	status?: string
	type?: string
}

export type EventTodosRecord = {
	assignedTo?: RecordIdString
	eventId: RecordIdString
	id: string
	priority?: string
	status?: string
	task: string
	taskOn?: IsoDateString
}

export type EventsRecord<Tcontributors = unknown, Tdate = unknown, TguestEmails = unknown, Tmeals = unknown, Ttodos = unknown> = {
	contributors?: null | Tcontributors
	createdBy?: RecordIdString
	date?: null | Tdate
	dateEnd?: IsoDateString
	dateStart?: IsoDateString
	guestEmails?: null | TguestEmails
	id: string
	joinToken?: string
	location?: string
	meals?: null | Tmeals
	name: string
	status?: string
	teams?: RecordIdString[]
	todos?: null | Ttodos
}

export type LocksRecord = {
	collection?: string
	expiresAt?: IsoDateString
	id: string
	recordId?: string
	userId?: RecordIdString
}

export type MaterielRecord = {
	createdBy?: RecordIdString
	deleted?: boolean
	description?: string
	id: string
	name: string
	ownerUser?: RecordIdString
	status?: string
	teamId?: RecordIdString
	type?: string
}

export type MaterielLoanRecord = {
	borrowerUser?: RecordIdString
	createdBy?: RecordIdString
	endDate?: IsoDateString
	eventId?: RecordIdString
	id: string
	materielId: RecordIdString
	startDate?: IsoDateString
	status?: string
}

export type NotificationsRecord<Tdata = unknown> = {
	data?: null | Tdata
	id: string
	link?: string
	message?: string
	read?: boolean
	title?: string
	type?: string
	userId: RecordIdString
}

export type ProductsRecord<Tspecs = unknown, Tstore = unknown> = {
	deleted?: boolean
	eventId: RecordIdString
	id: string
	pF?: boolean
	pS?: boolean
	productHugoUuid?: string
	productName?: string
	productType?: string
	specs?: null | Tspecs
	status?: string
	store?: null | Tstore
}

export type PurchasesRecord<Tstore = unknown> = {
	deleted?: boolean
	eventId: RecordIdString
	id: string
	status?: string
	store?: null | Tstore
}

export type RecipesRecord<Tcategories = unknown, Tingredients = unknown, Tsteps = unknown, Tyield = unknown> = {
	auteur?: string
	categories?: null | Tcategories
	createdBy?: RecordIdString
	description?: string
	id: string
	ingredients?: null | Tingredients
	lockedBy?: string
	published?: boolean
	steps?: null | Tsteps
	title: string
	typeR?: string
	yield?: null | Tyield
}

export type ShareLinksRecord = {
	id: string
	isActive?: boolean
	link_type?: string
	target_id?: string
	token?: string
}

export type TeamdocsRecord = {
	content?: string
	eventId?: RecordIdString
	id: string
	status?: string
	teamId?: RecordIdString
	title?: string
}

export type TeamsRecord = {
	id: string
	members?: RecordIdString[]
	name: string
}

export type UsersRecord = {
	avatar?: FileNameString
	created: IsoAutoDateString
	email: string
	emailVisibility?: boolean
	id: string
	name?: string
	password: string
	tokenKey: string
	updated: IsoAutoDateString
	verified?: boolean
}

// Response types include system fields and match responses from the PocketBase API
export type AuthoriginsResponse<Texpand = unknown> = Required<AuthoriginsRecord> & BaseSystemFields<Texpand>
export type ExternalauthsResponse<Texpand = unknown> = Required<ExternalauthsRecord> & BaseSystemFields<Texpand>
export type MfasResponse<Texpand = unknown> = Required<MfasRecord> & BaseSystemFields<Texpand>
export type OtpsResponse<Texpand = unknown> = Required<OtpsRecord> & BaseSystemFields<Texpand>
export type SuperusersResponse<Texpand = unknown> = Required<SuperusersRecord> & AuthSystemFields<Texpand>
export type EventMaterielResponse<Tspecs = unknown, Texpand = unknown> = Required<EventMaterielRecord<Tspecs>> & BaseSystemFields<Texpand>
export type EventTodosResponse<Texpand = unknown> = Required<EventTodosRecord> & BaseSystemFields<Texpand>
export type EventsResponse<Tcontributors = unknown, Tdate = unknown, TguestEmails = unknown, Tmeals = unknown, Ttodos = unknown, Texpand = unknown> = Required<EventsRecord<Tcontributors, Tdate, TguestEmails, Tmeals, Ttodos>> & BaseSystemFields<Texpand>
export type LocksResponse<Texpand = unknown> = Required<LocksRecord> & BaseSystemFields<Texpand>
export type MaterielResponse<Texpand = unknown> = Required<MaterielRecord> & BaseSystemFields<Texpand>
export type MaterielLoanResponse<Texpand = unknown> = Required<MaterielLoanRecord> & BaseSystemFields<Texpand>
export type NotificationsResponse<Tdata = unknown, Texpand = unknown> = Required<NotificationsRecord<Tdata>> & BaseSystemFields<Texpand>
export type ProductsResponse<Tspecs = unknown, Tstore = unknown, Texpand = unknown> = Required<ProductsRecord<Tspecs, Tstore>> & BaseSystemFields<Texpand>
export type PurchasesResponse<Tstore = unknown, Texpand = unknown> = Required<PurchasesRecord<Tstore>> & BaseSystemFields<Texpand>
export type RecipesResponse<Tcategories = unknown, Tingredients = unknown, Tsteps = unknown, Tyield = unknown, Texpand = unknown> = Required<RecipesRecord<Tcategories, Tingredients, Tsteps, Tyield>> & BaseSystemFields<Texpand>
export type ShareLinksResponse<Texpand = unknown> = Required<ShareLinksRecord> & BaseSystemFields<Texpand>
export type TeamdocsResponse<Texpand = unknown> = Required<TeamdocsRecord> & BaseSystemFields<Texpand>
export type TeamsResponse<Texpand = unknown> = Required<TeamsRecord> & BaseSystemFields<Texpand>
export type UsersResponse<Texpand = unknown> = Required<UsersRecord> & AuthSystemFields<Texpand>

// Types containing all Records and Responses, useful for creating typing helper functions

export type CollectionRecords = {
	_authOrigins: AuthoriginsRecord
	_externalAuths: ExternalauthsRecord
	_mfas: MfasRecord
	_otps: OtpsRecord
	_superusers: SuperusersRecord
	event_materiel: EventMaterielRecord
	event_todos: EventTodosRecord
	events: EventsRecord
	locks: LocksRecord
	materiel: MaterielRecord
	materiel_loan: MaterielLoanRecord
	notifications: NotificationsRecord
	products: ProductsRecord
	purchases: PurchasesRecord
	recipes: RecipesRecord
	share_links: ShareLinksRecord
	teamdocs: TeamdocsRecord
	teams: TeamsRecord
	users: UsersRecord
}

export type CollectionResponses = {
	_authOrigins: AuthoriginsResponse
	_externalAuths: ExternalauthsResponse
	_mfas: MfasResponse
	_otps: OtpsResponse
	_superusers: SuperusersResponse
	event_materiel: EventMaterielResponse
	event_todos: EventTodosResponse
	events: EventsResponse
	locks: LocksResponse
	materiel: MaterielResponse
	materiel_loan: MaterielLoanResponse
	notifications: NotificationsResponse
	products: ProductsResponse
	purchases: PurchasesResponse
	recipes: RecipesResponse
	share_links: ShareLinksResponse
	teamdocs: TeamdocsResponse
	teams: TeamsResponse
	users: UsersResponse
}

// Utility types for create/update operations

type ProcessCreateAndUpdateFields<T> = Omit<{
	// Omit AutoDate fields
	[K in keyof T as Extract<T[K], IsoAutoDateString> extends never ? K : never]: 
		// Convert FileNameString to File
		T[K] extends infer U ? 
			U extends (FileNameString | FileNameString[]) ? 
				U extends any[] ? File[] : File 
			: U
		: never
}, 'id'>

// Create type for Auth collections
export type CreateAuth<T> = {
	id?: RecordIdString
	email: string
	emailVisibility?: boolean
	password: string
	passwordConfirm: string
	verified?: boolean
} & ProcessCreateAndUpdateFields<T>

// Create type for Base collections
export type CreateBase<T> = {
	id?: RecordIdString
} & ProcessCreateAndUpdateFields<T>

// Update type for Auth collections
export type UpdateAuth<T> = Partial<
	Omit<ProcessCreateAndUpdateFields<T>, keyof AuthSystemFields>
> & {
	email?: string
	emailVisibility?: boolean
	oldPassword?: string
	password?: string
	passwordConfirm?: string
	verified?: boolean
}

// Update type for Base collections
export type UpdateBase<T> = Partial<
	Omit<ProcessCreateAndUpdateFields<T>, keyof BaseSystemFields>
>

// Get the correct create type for any collection
export type Create<T extends keyof CollectionResponses> =
	CollectionResponses[T] extends AuthSystemFields
		? CreateAuth<CollectionRecords[T]>
		: CreateBase<CollectionRecords[T]>

// Get the correct update type for any collection
export type Update<T extends keyof CollectionResponses> =
	CollectionResponses[T] extends AuthSystemFields
		? UpdateAuth<CollectionRecords[T]>
		: UpdateBase<CollectionRecords[T]>

// Type for usage with type asserted PocketBase instance
// https://github.com/pocketbase/js-sdk#specify-typescript-definitions

export type TypedPocketBase = {
	collection<T extends keyof CollectionResponses>(
		idOrName: T
	): RecordService<CollectionResponses[T]>
} & PocketBase
