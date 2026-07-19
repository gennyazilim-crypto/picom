# Profile Media Storage RLS

The profile-media bucket is private. Only WebP output produced by the Picom image pipeline is accepted and each stored object is capped at 4 MiB.

## Read policy

Authenticated users may read an object only when can_view_profile_media_object confirms that the target profile is visible under the existing profile privacy projection. Owners can always read their own objects. Blocked or otherwise private profiles are denied.

## Write policy

Authenticated users may insert only canonical paths whose embedded owner ID equals auth.uid(). Objects are immutable, so there is no update policy. Owners may delete their own old versions. Service-role access remains reserved for controlled operations.

## Security properties

- A client cannot upload into another user's namespace.
- A client cannot select a private profile image by guessing its path.
- MIME is restricted at bucket level and magic bytes are verified before upload.
- RPCs run with fixed search_path and validate authentication, kind, owner, version, hash, and path.
- Components never receive a service-role key.
