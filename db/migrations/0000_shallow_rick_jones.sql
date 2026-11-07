CREATE TABLE "phish_cache" (
	"key" text PRIMARY KEY NOT NULL,
	"data" json NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "show_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"phishnet_show_id" text NOT NULL,
	"phishnet_venue_id" text NOT NULL,
	"show_date" date NOT NULL,
	"venue_label" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"apple_sub" text NOT NULL,
	CONSTRAINT "user_apple_sub_unique" UNIQUE("apple_sub")
);
--> statement-breakpoint
ALTER TABLE "show_history" ADD CONSTRAINT "show_history_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "show_history_user_show_unique" ON "show_history" USING btree ("user_id","phishnet_show_id");