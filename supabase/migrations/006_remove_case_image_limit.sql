-- Run once after 005 to remove the earlier six-image cap.
alter table public.case_images
  drop constraint if exists case_images_sort_order_check;

alter table public.case_images
  add constraint case_images_sort_order_check check (sort_order >= 0);
