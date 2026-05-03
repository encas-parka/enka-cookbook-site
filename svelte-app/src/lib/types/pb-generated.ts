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
	Categories: "categories",
	EventMateriel: "event_materiel",
	EventTodos: "event_todos",
	Events: "events",
	Ingredients: "ingredients",
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

export const CategoriesTypeOptions = {
	"category": "category",
	"equipment_tag": "equipment_tag",
} as const
export type CategoriesTypeOptions = typeof CategoriesTypeOptions[keyof typeof CategoriesTypeOptions]
export type CategoriesRecord = {
	id: string
	name: string
	type: CategoriesTypeOptions
}

export const EventMaterielTypeOptions = {
	"electronic": "electronic",
	"manual": "manual",
	"other": "other",
	"tools": "tools",
	"dish": "dish",
	"gaz": "gaz",
	"cooking": "cooking",
	"hygiene": "hygiene",
} as const
export type EventMaterielTypeOptions = typeof EventMaterielTypeOptions[keyof typeof EventMaterielTypeOptions]

export const EventMaterielStatusOptions = {
	"to_find": "to_find",
	"to_check": "to_check",
	"confirmed": "confirmed",
} as const
export type EventMaterielStatusOptions = typeof EventMaterielStatusOptions[keyof typeof EventMaterielStatusOptions]
export type EventMaterielRecord<Tspecs = unknown> = {
	createdBy?: RecordIdString
	deleted?: boolean
	eventId: RecordIdString
	fromTeamName?: string
	groupId?: string
	id: string
	loanId?: RecordIdString
	name?: string
	notes?: string
	quantity?: number
	sourceMaterielId?: RecordIdString
	specs?: null | Tspecs
	status?: EventMaterielStatusOptions
	type?: EventMaterielTypeOptions
	where?: string
	who?: string
}

export const EventTodosPriorityOptions = {
	"low": "low",
	"medium": "medium",
	"high": "high",
} as const
export type EventTodosPriorityOptions = typeof EventTodosPriorityOptions[keyof typeof EventTodosPriorityOptions]

export const EventTodosStatusOptions = {
	"todo": "todo",
	"done": "done",
	"waiting": "waiting",
	"canceled": "canceled",
	"inprogress": "inprogress",
} as const
export type EventTodosStatusOptions = typeof EventTodosStatusOptions[keyof typeof EventTodosStatusOptions]
export type EventTodosRecord = {
	assignedTo?: RecordIdString
	dueDate?: IsoDateString
	eventId: RecordIdString
	id: string
	locked?: boolean
	priority?: EventTodosPriorityOptions
	requiredPeopleNb?: number
	status?: EventTodosStatusOptions
	task: string
	taskDescription?: string
	taskOn?: IsoDateString
}

export const EventsStatusOptions = {
	"archive": "archive",
	"locked": "locked",
	"proposition": "proposition",
	"confirmed": "confirmed",
	"canceled": "canceled",
} as const
export type EventsStatusOptions = typeof EventsStatusOptions[keyof typeof EventsStatusOptions]
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
	status?: EventsStatusOptions
	teams?: RecordIdString[]
	todos?: null | Ttodos
}

export const IngredientsTypeOptions = {
	"legumes": "legumes",
	"sec": "sec",
	"epices": "epices",
	"lof": "lof",
	"autres": "autres",
	"sucres": "sucres",
	"animaux": "animaux",
	"frais": "frais",
} as const
export type IngredientsTypeOptions = typeof IngredientsTypeOptions[keyof typeof IngredientsTypeOptions]
export type IngredientsRecord<Tallergens = unknown, Tsaisons = unknown> = {
	allergens?: null | Tallergens
	id: string
	name: string
	pF?: boolean
	pS?: boolean
	saisons?: null | Tsaisons
	type: IngredientsTypeOptions
	uuid: string
}

export type LocksRecord = {
	collection?: string
	expiresAt?: IsoDateString
	id: string
	recordId?: string
	userId?: RecordIdString
}

export const MaterielTypeOptions = {
	"electronic": "electronic",
	"manual": "manual",
	"other": "other",
	"tools": "tools",
	"dish": "dish",
	"gaz": "gaz",
	"cooking": "cooking",
	"hygiene": "hygiene",
} as const
export type MaterielTypeOptions = typeof MaterielTypeOptions[keyof typeof MaterielTypeOptions]

export const MaterielStatusOptions = {
	"ok": "ok",
	"lost": "lost",
	"torepair": "torepair",
} as const
export type MaterielStatusOptions = typeof MaterielStatusOptions[keyof typeof MaterielStatusOptions]
export type MaterielRecord = {
	createdBy?: RecordIdString
	deleted?: boolean
	description?: string
	id: string
	isStorage?: boolean
	location?: string
	name: string
	ownerUser?: RecordIdString
	quantity?: number
	shareableWith?: RecordIdString[]
	status?: MaterielStatusOptions
	storeIn?: RecordIdString
	teamId?: RecordIdString
	type?: MaterielTypeOptions
}

export const MaterielLoanStatusOptions = {
	"asked": "asked",
	"accepted": "accepted",
	"refused": "refused",
	"canceled": "canceled",
	"returned": "returned",
	"completed": "completed",
	"archived": "archived",
} as const
export type MaterielLoanStatusOptions = typeof MaterielLoanStatusOptions[keyof typeof MaterielLoanStatusOptions]
export type MaterielLoanRecord<Tmateriels = unknown> = {
	borrowerUser?: RecordIdString
	completedAt?: IsoDateString
	createdBy?: RecordIdString
	endDate?: IsoDateString
	eventId?: RecordIdString
	eventName?: string
	id: string
	materielId: RecordIdString
	materiels?: null | Tmateriels
	notes?: string
	ownerId?: RecordIdString
	ownerName?: string
	responsibleId?: RecordIdString
	responsibleName?: string
	returnNotes?: string
	returnedAt?: IsoDateString
	startDate?: IsoDateString
	status?: MaterielLoanStatusOptions
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

export type ProductsRecord<TmergedFrom = unknown, TpreviousNames = unknown, Tspecs = unknown, TstockReel = unknown, Tstore = unknown, TtotalNeededOverride = unknown, Twho = unknown> = {
	deleted?: boolean
	eventId: RecordIdString
	id: string
	isMerged?: boolean
	isSynced?: boolean
	mergeDate?: IsoDateString
	mergeReason?: string
	mergedFrom?: null | TmergedFrom
	mergedInto?: RecordIdString
	pF?: boolean
	pS?: boolean
	previousNames?: null | TpreviousNames
	productHugoUuid?: string
	productName?: string
	productType?: string
	specs?: null | Tspecs
	status?: string
	stockReel?: null | TstockReel
	store?: null | Tstore
	totalNeededOverride?: null | TtotalNeededOverride
	updatedBy?: RecordIdString
	who?: null | Twho
}

export type PurchasesRecord<Tstore = unknown> = {
	createdBy?: RecordIdString
	deleted?: boolean
	deliveryDate?: IsoDateString
	eventId: RecordIdString
	id: string
	invoiceId?: string
	invoiceTotal?: number
	notes?: string
	orderDate?: IsoDateString
	price?: number
	products?: RecordIdString[]
	quantity: number
	status?: string
	store?: null | Tstore
	unit: string
	who?: string
}

export const RecipesTypeROptions = {
	"entree": "entree",
	"plat": "plat",
	"dessert": "dessert",
	"autre": "autre",
} as const
export type RecipesTypeROptions = typeof RecipesTypeROptions[keyof typeof RecipesTypeROptions]

export const RecipesStatusOptions = {
	"public": "public",
	"private": "private",
	"deleted": "deleted",
} as const
export type RecipesStatusOptions = typeof RecipesStatusOptions[keyof typeof RecipesStatusOptions]
export type RecipesRecord<Tastuces = unknown, Tcategories = unknown, Tingredients = unknown, Tmateriel = unknown, TpermissionWrite = unknown, TprepAlt = unknown, Tregime = unknown, Tsaison = unknown, Tteams = unknown> = {
	astuces?: null | Tastuces
	auteur?: string
	categories?: null | Tcategories
	check?: boolean
	createdBy?: RecordIdString
	cuisson?: boolean
	description?: string
	draft?: boolean
	id: string
	ingredients?: null | Tingredients
	lockedBy?: string
	materiel?: null | Tmateriel
	permissionWrite?: null | TpermissionWrite
	plate?: number
	prepAlt?: null | TprepAlt
	preparation24h?: string
	preparation?: string
	publishedAt?: IsoDateString
	quantite_desc?: string
	regime?: null | Tregime
	region?: string
	rootRecipeId?: RecordIdString
	saison?: null | Tsaison
	serveHot?: boolean
	status?: RecipesStatusOptions
	teams?: null | Tteams
	title: string
	typeR?: RecipesTypeROptions
	versionLabel?: string
}

export type ShareLinksRecord = {
	access_level?: string
	expiresAt?: IsoDateString
	id: string
	isActive?: boolean
	link_type?: string
	maxUses?: number
	target_id?: string
	token?: string
	useCount?: number
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
export type CategoriesResponse<Texpand = unknown> = Required<CategoriesRecord> & BaseSystemFields<Texpand>
export type EventMaterielResponse<Tspecs = unknown, Texpand = unknown> = Required<EventMaterielRecord<Tspecs>> & BaseSystemFields<Texpand>
export type EventTodosResponse<Texpand = unknown> = Required<EventTodosRecord> & BaseSystemFields<Texpand>
export type EventsResponse<Tcontributors = unknown, Tdate = unknown, TguestEmails = unknown, Tmeals = unknown, Ttodos = unknown, Texpand = unknown> = Required<EventsRecord<Tcontributors, Tdate, TguestEmails, Tmeals, Ttodos>> & BaseSystemFields<Texpand>
export type IngredientsResponse<Tallergens = unknown, Tsaisons = unknown, Texpand = unknown> = Required<IngredientsRecord<Tallergens, Tsaisons>> & BaseSystemFields<Texpand>
export type LocksResponse<Texpand = unknown> = Required<LocksRecord> & BaseSystemFields<Texpand>
export type MaterielResponse<Texpand = unknown> = Required<MaterielRecord> & BaseSystemFields<Texpand>
export type MaterielLoanResponse<Tmateriels = unknown, Texpand = unknown> = Required<MaterielLoanRecord<Tmateriels>> & BaseSystemFields<Texpand>
export type NotificationsResponse<Tdata = unknown, Texpand = unknown> = Required<NotificationsRecord<Tdata>> & BaseSystemFields<Texpand>
export type ProductsResponse<TmergedFrom = unknown, TpreviousNames = unknown, Tspecs = unknown, TstockReel = unknown, Tstore = unknown, TtotalNeededOverride = unknown, Twho = unknown, Texpand = unknown> = Required<ProductsRecord<TmergedFrom, TpreviousNames, Tspecs, TstockReel, Tstore, TtotalNeededOverride, Twho>> & BaseSystemFields<Texpand>
export type PurchasesResponse<Tstore = unknown, Texpand = unknown> = Required<PurchasesRecord<Tstore>> & BaseSystemFields<Texpand>
export type RecipesResponse<Tastuces = unknown, Tcategories = unknown, Tingredients = unknown, Tmateriel = unknown, TpermissionWrite = unknown, TprepAlt = unknown, Tregime = unknown, Tsaison = unknown, Tteams = unknown, Texpand = unknown> = Required<RecipesRecord<Tastuces, Tcategories, Tingredients, Tmateriel, TpermissionWrite, TprepAlt, Tregime, Tsaison, Tteams>> & BaseSystemFields<Texpand>
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
	categories: CategoriesRecord
	event_materiel: EventMaterielRecord
	event_todos: EventTodosRecord
	events: EventsRecord
	ingredients: IngredientsRecord
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
	categories: CategoriesResponse
	event_materiel: EventMaterielResponse
	event_todos: EventTodosResponse
	events: EventsResponse
	ingredients: IngredientsResponse
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
