import { dedent } from '@svelte-cli/core';
import { options } from './options.ts';
import { common, imports } from '@svelte-cli/core/js';
import { addFromRawHtml } from '@svelte-cli/core/html';
import { createPrinter } from '@svelte-cli/core/shared';

/** @type {Array<import('@svelte-cli/core').FileType<typeof options>>} */
export const demos = [
    // Demo routes when user has selected Basic Auth and/or Magic Link
    {
        name: ({ kit }) => `${kit?.routesDirectory}/+page.svelte`,
        contentType: 'svelte',
        condition: ({ options }) => options.demo,
        content: ({ jsAst, htmlAst }) => {
            imports.addNamed(jsAst, '$app/stores', { page: 'page' });

            common.addFromString(
                jsAst,
                `
                    async function logout()  {
                        const { error } = await $page.data.supabase.auth.signOut();
                        if (error) {
                            console.error(error);
                        }
                    };
                `
            );

            addFromRawHtml(
                htmlAst.childNodes,
                dedent`
                    <h1>Welcome to SvelteKit with Supabase</h1>
                    <ul>
                    <li><a href="/auth">Login</a></li>
                    <li><a href="/private">Protected page</a></li>
                    </ul>
                    {#if $page.data.user}
                        <a href="/" on:click={logout} data-sveltekit-reload>Logout</a>
                    {/if}
                    <pre>
                        User: {JSON.stringify($page.data.user, null, 2)}
                    </pre>
                `
            );
        },
    },
    {
        name: ({ kit, typescript }) =>
            `${kit?.routesDirectory}/private/+layout.server.${
                typescript ? 'ts' : 'js'
            }`,
        condition: ({ options }) => options.demo,
        content: () => {
            return dedent`
                /**
                * This file is necessary to ensure protection of all routes in the \`private\`
                * directory. It makes the routes in this directory _dynamic_ routes, which
                * send a server request, and thus trigger \`hooks.server.ts\`.
                **/
                `;
        },
    },
    {
        name: ({ kit }) => `${kit?.routesDirectory}/private/+layout.svelte`,
        condition: ({ options }) => options.demo,
        content: () => {
            return dedent`
                <script>
                    let { children, data } = $props();
                    let { supabase } = $derived(data);

                    async function logout() {
                        const { error } = await supabase.auth.signOut();
                        if (error) {
                            console.error(error);
                        }
                    };
                </script>

                <header>
                    <nav>
                        <a href="/">Home</a>
                    </nav>
                    <a href="/" onclick={logout} data-sveltekit-reload>Logout</a>
                </header>
                <main>
                    {@render children?.()}
                </main>
                `;
        },
    },
    {
        name: ({ kit }) => `${kit?.routesDirectory}/private/+page.svelte`,
        condition: ({ options }) => options.demo,
        content: ({ options, typescript }) => {
            const [ts, cli] = createPrinter(typescript, options.cli);
            return dedent`
                <script${ts(' lang="ts"')}>
                    import { invalidate } from '$app/navigation'

                    let { data } = $props();
                    let { ${cli(
                        'notes, supabase, user',
                        'user'
                    )} } = $derived(data);

                    ${cli(`
                    async function handleSubmit(evt${ts(': SubmitEvent')}) {
                        evt.preventDefault();
                        if (!evt.target) return;

                        const form = evt.target${ts(' as HTMLFormElement')}

                        const note = (new FormData(form).get('note') ?? '')${ts(
                            ' as string'
                        )}
                        if (!note) return;

                        const { error } = await supabase.from('notes').insert({ note });
                        if (error) console.error(error);

                        invalidate('supabase:db:notes');
                        form.reset();
                    }
                        `)}
                </script>

                <h1>Private page for user: {user?.email}</h1>
                ${cli(`
                <h2>Notes</h2>
                <ul>
                    {#each notes as note}
                        <li>{note.note}</li>
                    {/each}
                </ul>
                <form onsubmit={handleSubmit}>
                    <label>
                        Add a note
                        <input name="note" type="text" />
                    </label>
                </form>
                        `)}
                `;
        },
    },
    {
        name: ({ kit, typescript }) =>
            `${kit?.routesDirectory}/private/+page.server.${
                typescript ? 'ts' : 'js'
            }`,
        condition: ({ options }) => options.demo && options.cli,
        content: ({ typescript }) => {
            const [ts] = createPrinter(typescript);
            return dedent`
                ${ts(`import type { PageServerLoad } from './$types'\n`)}
                export const load${ts(
                    ': PageServerLoad'
                )} = async ({ depends, locals: { supabase } }) => {
                    depends('supabase:db:notes')
                    const { data: notes } = await supabase.from('notes').select('id,note').order('id')
                    return { notes: notes ?? [] }
                }
                `;
        },
    },
    {
        name: () => './supabase/migrations/00000000000000_demo.sql',
        condition: ({ options }) => options.demo && options.cli,
        content: () => {
            return dedent`
                create table notes (
                    id bigint primary key generated always as identity,
                    created_at timestamp with time zone not null default now(),
                    user_id uuid references auth.users on delete cascade not null default auth.uid(),
                    note text not null
                );

                alter table notes enable row level security;

                revoke all on table notes from authenticated;
                revoke all on table notes from anon;

                grant all (note) on table notes to authenticated;
                grant select (id) on table notes to authenticated;
                grant delete on table notes to authenticated;

                create policy "Users can access and modify their own notes"
                on notes
                for all
                to authenticated
                using ((select auth.uid()) = user_id);
                `;
        },
    },
];
