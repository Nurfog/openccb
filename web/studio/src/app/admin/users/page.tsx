'use client';

import { useState, useEffect } from 'react';
import { cmsApi, User, Organization } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { UserCog, Mail, Search, Filter, ShieldCheck } from 'lucide-react';

export default function UsersPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const { user: currentUser } = useAuth();

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [usersData, orgsData] = await Promise.all([
                cmsApi.getAllUsers(),
                cmsApi.getOrganizations()
            ]);
            setUsers(usersData);
            setOrganizations(orgsData);
        } catch (error) {
            console.error('Failed to load data', error);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateUser = async (userId: string, role: string, orgId: string) => {
        try {
            await cmsApi.updateUser(userId, { role, organization_id: orgId });
            loadData();
        } catch (error) {
            console.error('Failed to update user', error);
        }
    };

    const filteredUsers = users.filter(u => {
        const matchesSearch = u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.email.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesRole = roleFilter === '' || u.role === roleFilter;
        return matchesSearch && matchesRole;
    });

    if (currentUser?.role !== 'admin') {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                <div className="p-4 rounded-full bg-red-500/10 mb-4">
                    <ShieldCheck className="w-12 h-12 text-red-500" />
                </div>
                <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
                <p className="text-gray-400">Only system administrators can access this page.</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
                <p className="text-gray-400 mt-1">Manage global users, roles, and organization assignments.</p>
            </div>

            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                        type="text"
                        placeholder="Search users..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                </div>
                <div className="flex gap-4">
                    <div className="relative">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <select
                            value={roleFilter}
                            onChange={(e) => setRoleFilter(e.target.value)}
                            className="bg-black/40 border border-white/10 rounded-lg pl-10 pr-8 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none cursor-pointer"
                        >
                            <option value="">All Roles</option>
                            <option value="admin">Admin</option>
                            <option value="instructor">Instructor</option>
                            <option value="student">Student</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="glass border border-white/10 rounded-xl overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-white/5 border-b border-white/10">
                        <tr>
                            <th className="px-6 py-4 text-sm font-semibold">User</th>
                            <th className="px-6 py-4 text-sm font-semibold">Role</th>
                            <th className="px-6 py-4 text-sm font-semibold">Organization</th>
                            <th className="px-6 py-4 text-sm font-semibold text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {loading ? (
                            [1, 2, 3, 4, 5].map(i => (
                                <tr key={i} className="animate-pulse">
                                    <td className="px-6 py-4"><div className="h-4 w-32 bg-white/10 rounded" /></td>
                                    <td className="px-6 py-4"><div className="h-4 w-16 bg-white/10 rounded" /></td>
                                    <td className="px-6 py-4"><div className="h-4 w-24 bg-white/10 rounded" /></td>
                                    <td className="px-6 py-4 text-right"><div className="h-4 w-8 bg-white/10 ml-auto rounded" /></td>
                                </tr>
                            ))
                        ) : filteredUsers.map((u) => (
                            <tr key={u.id} className="hover:bg-white/[0.02] transition-colors group">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400">
                                            {u.full_name[0]}
                                        </div>
                                        <div>
                                            <div className="font-medium">{u.full_name}</div>
                                            <div className="text-xs text-gray-500 flex items-center gap-1">
                                                <Mail className="w-3 h-3" /> {u.email}
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <select
                                        value={u.role}
                                        onChange={(e) => handleUpdateUser(u.id, e.target.value, u.organization_id || '00000000-0000-0000-0000-000000000000')}
                                        className="bg-black/20 border border-white/5 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500/50"
                                    >
                                        <option value="admin">Admin</option>
                                        <option value="instructor">Instructor</option>
                                        <option value="student">Student</option>
                                    </select>
                                </td>
                                <td className="px-6 py-4">
                                    <select
                                        value={u.organization_id || '00000000-0000-0000-0000-000000000000'}
                                        onChange={(e) => handleUpdateUser(u.id, u.role, e.target.value)}
                                        className="bg-black/20 border border-white/5 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500/50 max-w-[150px]"
                                    >
                                        {organizations.map(org => (
                                            <option key={org.id} value={org.id}>{org.name}</option>
                                        ))}
                                    </select>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button className="p-2 hover:bg-white/10 rounded-lg transition-all text-gray-400 hover:text-white opacity-0 group-hover:opacity-100">
                                        <UserCog className="w-4 h-4" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {!loading && filteredUsers.length === 0 && (
                    <div className="p-12 text-center text-gray-500">
                        No users found matching your search.
                    </div>
                )}
            </div>
        </div>
    );
}
