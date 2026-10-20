// Journal API — a trip told day by day: what was planned, what was visited,
// the traveller's note for each day, and their photos.
import { createClient } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";
import { useMutation, useQueryClient } from "@tanstack/solid-query";
import {
  JournalService,
  ConfirmPhotoRequestSchema,
  CreatePhotoUploadRequestSchema,
  DeletePhotoRequestSchema,
  GetTripJournalRequestSchema,
  SetDayDiaryRequestSchema,
} from "@buf/loci_loci-proto.bufbuild_es/loci/journal/journal_pb.js";
import { transport } from "../connect-transport";
import { useAppQuery } from "./authed-query";
import { downscale } from "../journal/resize";
import { uploadPhoto, type PhotoTarget, type UploadDeps } from "../journal/upload";
import { toJournalView, toPhotoView } from "../journal/view";

const journalClient = createClient(JournalService, transport);

export const journalKeys = {
  all: ["journal"] as const,
  trip: (tripId: string) => ["journal", "trip", tripId] as const,
};

export const useTripJournal = (tripId: () => string | undefined) =>
  useAppQuery(() => ({
    queryKey: journalKeys.trip(tripId() ?? ""),
    queryFn: async () => {
      const res = await journalClient.getTripJournal(
        create(GetTripJournalRequestSchema, { tripId: tripId() ?? "" }),
      );
      if (!res.journal) throw new Error("No journal for this trip.");
      return toJournalView(res.journal);
    },
    enabled: !!tripId(),
    staleTime: 30 * 1000,
    retry: false,
  }));

export const useSetDayDiary = (tripId: () => string) => {
  const queryClient = useQueryClient();
  return useMutation(() => ({
    mutationFn: async (input: { dayId: string; text: string }) => {
      const res = await journalClient.setDayDiary(create(SetDayDiaryRequestSchema, input));
      return res.diary;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: journalKeys.trip(tripId()) }),
  }));
};

const uploadDeps: UploadDeps = {
  create: async (input) => {
    const res = await journalClient.createPhotoUpload(
      create(CreatePhotoUploadRequestSchema, { ...input, sizeBytes: BigInt(input.sizeBytes) }),
    );
    return { photoId: res.photoId, uploadUrl: res.uploadUrl, headers: res.headers };
  },
  put: (url, body, headers) => fetch(url, { method: "PUT", body, headers }),
  confirm: async (photoId, caption) => {
    const res = await journalClient.confirmPhoto(
      create(ConfirmPhotoRequestSchema, { photoId, caption }),
    );
    if (!res.photo) throw new Error("The photo didn't save.");
    return toPhotoView(res.photo);
  },
  remove: async (photoId) => {
    await journalClient.deletePhoto(create(DeletePhotoRequestSchema, { photoId }));
  },
};

/**
 * Adds photos to a trip, a day or a stop, one at a time. Resolves with how
 * many saved; the ones that failed are left out rather than failing the rest.
 */
export const useAddPhotos = () => {
  const queryClient = useQueryClient();
  return useMutation(() => ({
    mutationFn: async (input: { target: PhotoTarget; files: File[] }) => {
      let saved = 0;
      for (const file of input.files) {
        const blob = await downscale(file);
        const ok = await uploadPhoto(uploadDeps, input.target, blob).then(
          () => true,
          () => false,
        );
        if (ok) saved++;
      }
      return { saved, failed: input.files.length - saved };
    },
    onSettled: (_data, _err, input) =>
      queryClient.invalidateQueries({ queryKey: journalKeys.trip(input.target.tripId) }),
  }));
};

export const useDeletePhoto = (tripId: () => string) => {
  const queryClient = useQueryClient();
  return useMutation(() => ({
    mutationFn: (photoId: string) => uploadDeps.remove(photoId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: journalKeys.trip(tripId()) }),
  }));
};
