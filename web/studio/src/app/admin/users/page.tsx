'use client';

import { useState, useEffect } from 'react';
import { cmsApi, User, Organization } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { UserCog, Mail, Search, Filter, ShieldCheck, Plus, X, UserPlus, Key, User as UserIcon, Building2, Gauge, Trash2, AlertTriangle } from 'lucide-react';

interface UserWithLimit extends User {
    monthly_token_limit?: number;
    token_usage_percentage?: number;
}

export default function UsersPage() {
    const [users, setUsers] = useState<UserWithLimit[]>([]);
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const { user: currentUser } = useAuth();
    const [tokenLimits, setTokenLimits] = useState<Record<string, {limit: number, percentage: number}>>({});

    // Delete User States
    const [deleteConfirm, setDeleteConfirm] = useState<UserWithLimit | null>(null);
    const [deleting, setDeleting] = useState(false);

    // Create User States
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newUser, setNewUser] = useState({
        email: '',
        password: '',
        full_name: '',
        role: 'student',
        organization_id: ''
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [usersData, orgData] = await Promise.all([
                cmsApi.getAllUsers(),
                cmsApi.getOrganization()
            ]);
            setUsers(usersData);
            setOrganizations([orgData]);
            
            // Load token limits for each user
            const limits: Record<string, {limit: number, percentage: number}> = {};
            for (const user of usersData) {
                try {
                    const resp = await fetch(
                        `${process.env.NEXT_PUBLIC_CMS_API_URL || 'http://localhost:3001'}/admin/users/${user.id}/token-limit/check`,
                        { credentials: 'include' }
                    );
                    if (resp.ok) {
                        const data = await resp.json();
                        limits[user.id] = {
                            limit: data.monthly_limit,
                            percentage: data.monthly_limit > 0 
                                ? Math.round((data.used_tokens / data.monthly_limit) * 100)
                                : 0,
                        };
                    }
                } catch (err) {
                    console.error(`Failed to load limit for user ${user.id}:`, err);
                }
            }
            setTokenLimits(limits);
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

    const handleDeleteUser = async () => {
        if (!deleteConfirm) return;
        setDeleting(true);
        try {
            await cmsApi.deleteUser(deleteConfirm.id);
            setDeleteConfirm(null);
            loadData();
        } catch (error) {
            console.error('Failed to delete user', error);
            alert('No se pudo eliminar el usuario.');
        } finally {
            setDeleting(false);
        }
    };

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await cmsApi.createUser(newUser);
            setNewUser({ email: '', password: '', full_name: '', role: 'student', organization_id: '' });
            setIsModalOpen(false);
            loadData();
        } catch (error) {
            console.error('Failed to create user', error);
            alert('Failed to create user. Ensure email is unique.');
        }
    };

    const filteredUsers = users.filter(u => {
        const safeName = (u.full_name || '').toLowerCase();
        const safeEmail = (u.email || '').toLowerCase();
        const term = searchTerm.toLowerCase();

        const matchesSearch = safeName.includes(term) || safeEmail.includes(term);
        const matchesRole = roleFilter === '' || u.role === roleFilter;
        return matchesSearch && matchesRole;
    });

    const formatNumber = (num: number) => new Intl.NumberFormat('en-US').format(num);

    if (currentUser?.role !== 'admin') {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-4">
                <div className="p-4 rounded-full bg-red-500/10 mb-4">
                    <ShieldCheck className="w-12 h-12 text-red-500" />
                </div>
                <h1 className="text-2xl font-bold mb-2 text-slate-900 dark:text-white">Access Denied</h1>
                <p className="text-slate-600 dark:text-gray-400">Only system administrators can access this page.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500 p-4 md:p-0">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">User Management</h1>
                    <p className="text-slate-600 dark:text-gray-400 mt-1 text-sm">Manage users, roles, and organization assignments.</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all shadow-lg shadow-blue-500/20"
                >
                    <Plus className="w-4 h-4" />
                    <span>Add User</span>
                </button>
            </div>

            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search users..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-white dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-slate-900 dark:text-white shadow-sm dark:shadow-none"
                    />
                </div>
                <div className="flex gap-4">
                    <div className="relative">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <select
                            value={roleFilter}
                            onChange={(e) => setRoleFilter(e.target.value)}
                            className="bg-white dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-lg pl-10 pr-8 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none cursor-pointer text-slate-900 dark:text-white h-full shadow-sm dark:shadow-none"
                        >
                            <option value="">All Roles</option>
                            <option value="admin">Admin</option>
                            <option value="instructor">Instructor</option>
                            <option value="student">Student</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden shadow-sm dark:shadow-none">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/10">
                            <tr>
                                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400">User</th>
                                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400">Role</th>
                                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400">Organization</th>
                                <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400">Token Limit</th>
                                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                            {loading ? (
                                [1, 2, 3, 4, 5].map(i => (
                                    <tr key={i} className="animate-pulse">
                                        <td className="px-6 py-4"><div className="h-4 w-32 bg-slate-100 dark:bg-white/10 rounded" /></td>
                                        <td className="px-6 py-4"><div className="h-4 w-16 bg-slate-100 dark:bg-white/10 rounded" /></td>
                                        <td className="px-6 py-4"><div className="h-4 w-24 bg-slate-100 dark:bg-white/10 rounded" /></td>
                                        <td className="px-6 py-4 text-right"><div className="h-4 w-8 bg-slate-100 dark:bg-white/10 ml-auto rounded" /></td>
                                    </tr>
                                ))
                            ) : filteredUsers.map((u) => (
                                <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold border border-blue-500/20">
                                                {((u.full_name || u.email || '?').trim().charAt(0) || '?').toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="font-bold text-slate-900 dark:text-white text-sm">{u.full_name || 'Sin nombre'}</div>
                                                <div className="text-[10px] text-slate-500 dark:text-gray-500 flex items-center gap-1 font-mono">
                                                    <Mail className="w-3 h-3" /> {u.email || 'sin-email'}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <select
                                            value={u.role}
                                            onChange={(e) => handleUpdateUser(u.id, e.target.value, u.organization_id || '00000000-0000-0000-0000-000000000000')}
                                            className="bg-white dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500/50 text-slate-900 dark:text-white"
                                        >
                                            <option value="admin">Admin</option>
                                            <option value="instructor">Instructor</option>
                                            <option value="student">Student</option>
                                        </select>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <Building2 className="w-3 h-3 text-slate-400" />
                                            <select
                                                value={u.organization_id || '00000000-0000-0000-0000-000000000000'}
                                                onChange={(e) => handleUpdateUser(u.id, u.role, e.target.value)}
                                                className="bg-white dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500/50 max-w-[150px] text-slate-900 dark:text-white"
                                            >
                                                {organizations.map(org => (
                                                    <option key={org.id} value={org.id}>{org.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {tokenLimits[u.id] ? (
                                            <div className="flex flex-col items-center gap-1">
                                                <span className={`text-xs font-bold px-2 py-1 rounded ${
                                                    tokenLimits[u.id].percentage >= 100 ? 'text-red-600 bg-red-50 dark:bg-red-900/20' :
                                                    tokenLimits[u.id].percentage >= 80 ? 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20' :
                                                    tokenLimits[u.id].percentage >= 50 ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' :
                                                    'text-green-600 bg-green-50 dark:bg-green-900/20'
                                                }`}>
                                                    {tokenLimits[u.id].limit === 0 ? '∞' : `${tokenLimits[u.id].percentage}%`}
                                                </span>
                                                {tokenLimits[u.id].limit > 0 && (
                                                    <div className="w-20 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full ${
                                                                tokenLimits[u.id].percentage >= 100 ? 'bg-red-600' :
                                                                tokenLimits[u.id].percentage >= 80 ? 'bg-yellow-600' :
                                                                tokenLimits[u.id].percentage >= 50 ? 'bg-blue-600' :
                                                                'bg-green-600'
                                                            }`}
                                                            style={{ width: `${Math.min(tokenLimits[u.id].percentage, 100)}%` }}
                                                        />
                                                    </div>
                                                )}
                                                <span className="text-[9px] text-gray-400">
                                                    {tokenLimits[u.id].limit === 0 ? 'Unlimited' : formatNumber(tokenLimits[u.id].limit)}
                                                </span>
                                            </div>
                                        ) : (
                                            <span className="text-xs text-gray-400">-</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                            <button className="p-2 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg transition-all text-slate-400 hover:text-slate-900 dark:hover:text-white">
                                                <UserCog className="w-4 h-4" />
                                            </button>
                                            {u.id !== currentUser?.id && (
                                                <button
                                                    onClick={() => setDeleteConfirm(u)}
                                                    className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-all text-slate-400 hover:text-red-600 dark:hover:text-red-400"
                                                    title="Eliminar usuario"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {!loading && filteredUsers.length === 0 && (
                    <div className="p-12 text-center text-slate-500 dark:text-gray-500">
                        No users found matching your search.
                    </div>
                )}
            </div>

            {/* Delete Confirmation Modal */}
            {deleteConfirm && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-8 shadow-2xl">
                        <div className="flex flex-col items-center gap-4 text-center">
                            <div className="p-3 rounded-full bg-red-500/10">
                                <AlertTriangle className="w-8 h-8 text-red-500" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">Eliminar usuario</h2>
                                <p className="text-slate-500 dark:text-gray-400 text-sm">
                                    ¿Confirmas que deseas eliminar a <span className="font-semibold text-slate-700 dark:text-white">{deleteConfirm.full_name || deleteConfirm.email}</span>? Esta acción no se puede deshacer.
                                </p>
                            </div>
                            <div className="flex gap-3 w-full mt-2">
                                <button
                                    onClick={() => setDeleteConfirm(null)}
                                    disabled={deleting}
                                    className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 rounded-lg transition-all text-slate-600 dark:text-white font-medium disabled:opacity-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleDeleteUser}
                                    disabled={deleting}
                                    className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-all font-bold disabled:opacity-50"
                                >
                                    {deleting ? 'Eliminando...' : 'Eliminar'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Create User Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-8 shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                                    <UserPlus className="w-5 h-5" />
                                </div>
                                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Add New User</h2>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full transition-colors text-slate-400">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateUser} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-600 dark:text-gray-400 mb-1.5">Full Name</label>
                                <div className="relative">
                                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="text"
                                        required
                                        value={newUser.full_name}
                                        onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                                        className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-slate-900 dark:text-white placeholder-slate-400"
                                        placeholder="e.g. John Doe"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-600 dark:text-gray-400 mb-1.5">Email Address</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="email"
                                        required
                                        value={newUser.email}
                                        onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                                        className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-mono text-sm text-slate-900 dark:text-white placeholder-slate-400"
                                        placeholder="user@example.com"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-600 dark:text-gray-400 mb-1.5">Initial Password</label>
                                <div className="relative">
                                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="password"
                                        required
                                        value={newUser.password}
                                        onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                                        className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-slate-900 dark:text-white placeholder-slate-400"
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-600 dark:text-gray-400 mb-1.5">User Role</label>
                                <select
                                    value={newUser.role}
                                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                                    className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all appearance-none cursor-pointer text-slate-900 dark:text-white"
                                >
                                    <option value="student">Student</option>
                                    <option value="instructor">Instructor</option>
                                    <option value="admin">Administrator (Organization Admin)</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-600 dark:text-gray-400 mb-1.5">Organization</label>
                                <select
                                    value={newUser.organization_id}
                                    onChange={(e) => setNewUser({ ...newUser, organization_id: e.target.value })}
                                    className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all appearance-none cursor-pointer text-slate-900 dark:text-white"
                                >
                                    <option value="">Default (Current Context)</option>
                                    {organizations.map(org => (
                                        <option key={org.id} value={org.id}>{org.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex gap-3 mt-8">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 rounded-lg transition-all text-slate-600 dark:text-white font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-[2] px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all shadow-lg shadow-blue-500/20 font-bold"
                                >
                                    Create User
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
