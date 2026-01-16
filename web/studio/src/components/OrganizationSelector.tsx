"use client";

import React, { useState } from "react";
import Modal from "./Modal";
import Combobox from "./Combobox";
import { Organization } from "@/lib/api";

interface OrganizationSelectorProps {
    isOpen: boolean;
    onClose: () => void;
    organizations: Organization[];
    onConfirm: (orgId: string | undefined) => void;
    title: string;
    actionLabel: string;
}

export default function OrganizationSelector({
    isOpen,
    onClose,
    organizations,
    onConfirm,
    title,
    actionLabel
}: OrganizationSelectorProps) {
    const [selectedId, setSelectedId] = useState<string>("");

    const handleConfirm = () => {
        onConfirm(selectedId || undefined);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title}>
            <div className="space-y-6">
                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                        Target Organization
                    </label>
                    <Combobox
                        options={organizations}
                        value={selectedId}
                        onChange={setSelectedId}
                        placeholder="Search or Select Organization..."
                    />
                    <p className="mt-3 text-xs text-gray-500 italic">
                        Leave empty to use the Default Organization.
                    </p>
                </div>

                <div className="flex gap-3 pt-2">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all text-sm font-medium"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        className="flex-[2] px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all shadow-lg shadow-blue-500/20 font-bold text-sm"
                    >
                        {actionLabel}
                    </button>
                </div>
            </div>
        </Modal>
    );
}
