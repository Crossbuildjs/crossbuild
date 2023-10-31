import Link from "@docusaurus/Link"
import useDocusaurusContext from "@docusaurus/useDocusaurusContext"
import Layout from "@theme/Layout"
import clsx from "clsx"
import React from "react"

import styles from "./index.module.css"

function HomepageHeader() {
	const { siteConfig } = useDocusaurusContext()
	return (
		<header className={clsx("hero hero--primary", styles.heroBanner)}>
			<div className="container">
				<h1 className="hero__title">{siteConfig.title}</h1>
				<p className="hero__subtitle">{siteConfig.tagline}</p>
				<div className={styles.buttons}>
					<Link
						className="button button--secondary button--lg"
						to="/docs/intro"
					>
						Get Started
					</Link>
				</div>
			</div>
		</header>
	)
}

// biome-ignore lint/correctness/noUndeclaredVariables: JSX is weird with global
export default function Home(): JSX.Element {
	return (
		<Layout title={`CrossBuild`} description="Docs for CrossBuild">
			<HomepageHeader />
			{/* <main>
                <HomepageFeatures />
            </main> */}
		</Layout>
	)
}
