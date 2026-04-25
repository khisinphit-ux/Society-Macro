-- Run AFTER creating the `progress-photos` bucket (private).
-- File path convention: <client_id>/<uuid>.jpg
-- The first folder must equal the owning client's UUID, so we can scope access.

-- Clients: read/write their own folder.
create policy "client photos read own"
  on storage.objects for select
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "client photos write own"
  on storage.objects for insert
  with check (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "client photos delete own"
  on storage.objects for delete
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- Trainers: read photos for any client linked to them.
create policy "trainer photos read clients"
  on storage.objects for select
  using (
    bucket_id = 'progress-photos'
    and exists (
      select 1 from public.trainer_clients
      where trainer_id = auth.uid()
        and client_id::text = (storage.foldername(name))[1]
    )
  );
