<?php
/**
 * FTS Custom Live Chat (Tawk.to) - Modern Redesign
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class FTS_Live_Chat {

    public function __construct() {
        // Enqueue Styles & Scripts
        add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_assets' ) );
        
        // Add Chat Trigger HTML
        add_action( 'wp_footer', array( $this, 'render_trigger' ) );
        
        // Add Tawk.to Script
        add_action( 'wp_footer', array( $this, 'render_tawk_script' ), 100 );
    }

    public function enqueue_assets() {
        if ( function_exists( 'is_singular' ) && is_singular( 'trip' ) ) {
            return;
        }
        ?>
        <style>
            #tawkchat-minified-wrapper,
            #tawkchat-minified,
            .tawk-min-container,
            .tawk-button {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
                pointer-events: none !important;
            }

            /* Modern Chat Hub Styles */
            :root {
                --fts-brand: #ff7f50;
                --fts-brand-hover: #e66a3c;
                --fts-whatsapp: #25D366;
                --fts-whatsapp-hover: #20bd5a;
                --fts-dark: #2d3436;
                --fts-white: #ffffff;
                --fts-glass: rgba(255, 255, 255, 0.9);
                --fts-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
            }

            /* Premium Chat Hub Redesign */
            :root {
                --fts-gradient: linear-gradient(135deg, #ff7f50 0%, #ff4b2b 100%);
                --fts-brand: #ff7f50;
                --fts-brand-hover: #ff4b2b;
                --fts-whatsapp: #25D366;
                --fts-whatsapp-hover: #1ebd5e;
                --fts-dark: #1a1a1a;
                --fts-white: #ffffff;
                --fts-glass: rgba(255, 255, 255, 0.95);
                --fts-shadow: 0 15px 35px rgba(255, 75, 43, 0.25);
                --fts-glow: 0 0 20px rgba(255, 127, 80, 0.4);
            }

            .fts-modern-chat-hub {
                position: fixed !important;
                bottom: 35px !important;
                right: 35px !important;
                z-index: 9999 !important;
                display: flex !important;
                flex-direction: column !important;
                align-items: flex-end !important;
                font-family: 'Outfit', -apple-system, sans-serif !important;
            }

            /* Main Trigger Button */
            .fts-chat-main-trigger {
                width: 55px !important;
                height: 55px !important;
                background: var(--fts-gradient) !important;
                border-radius: 20px 20px 4px 20px !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                cursor: pointer !important;
                box-shadow: var(--fts-shadow) !important;
                transition: all 0.3s ease !important;
                color: var(--fts-white) !important;
                position: relative !important;
                z-index: 10 !important;
                border: none !important;
            }

            .fts-chat-main-trigger:hover {
                transform: translateY(-3px) !important;
                box-shadow: 0 20px 45px rgba(255, 75, 43, 0.35) !important;
            }

            .fts-chat-main-trigger .fts-icon-container {
                position: relative !important;
                width: 100% !important;
                height: 100% !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
            }

            .fts-chat-main-trigger svg {
                width: 24px !important;
                height: 24px !important;
                display: block !important;
                margin: 0 !important;
                padding: 0 !important;
            }

            /* Toggle Logic: Display None/Block */
            .fts-chat-main-trigger .close-icon {
                display: none !important;
            }
            .fts-chat-main-trigger .main-icon {
                display: block !important;
            }

            .fts-modern-chat-hub.active .fts-chat-main-trigger {
                background: var(--fts-dark) !important;
                border-radius: 50% !important;
            }

            .fts-modern-chat-hub.active .fts-chat-main-trigger .close-icon {
                display: block !important;
                font-size: 24px !important;
            }
            .fts-modern-chat-hub.active .fts-chat-main-trigger .main-icon {
                display: none !important;
            }

            /* Options Container */
            .fts-chat-options {
                display: flex !important;
                flex-direction: column !important;
                gap: 15px !important;
                margin-bottom: 25px !important;
                opacity: 0 !important;
                visibility: hidden !important;
                transform: translateY(20px) !important;
                transition: all 0.3s ease !important;
                pointer-events: none !important;
            }

            .fts-modern-chat-hub.active .fts-chat-options {
                opacity: 1 !important;
                visibility: visible !important;
                transform: translateY(0) !important;
                pointer-events: auto !important;
            }

            /* Individual Option Buttons */
            .fts-chat-option {
                width: 48px !important;
                height: 48px !important;
                border-radius: 14px !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                cursor: pointer !important;
                color: var(--fts-white) !important;
                font-size: 20px !important;
                box-shadow: 0 8px 20px rgba(0,0,0,0.1) !important;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
                position: relative !important;
                text-decoration: none !important;
                border: 2px solid rgba(255,255,255,0.8) !important;
            }

            .fts-chat-option.whatsapp { 
                background: var(--fts-whatsapp) !important;
                transition-delay: 0.1s !important;
            }
            .fts-chat-option.live-chat { 
                background: var(--fts-brand) !important;
                transition-delay: 0s !important;
            }

            .fts-chat-option:hover {
                transform: scale(1.1) translateX(-5px) !important;
                box-shadow: 0 12px 25px rgba(0,0,0,0.15) !important;
            }

            /* Tooltips Redesign */
            .fts-tooltip {
                position: absolute !important;
                right: 75px !important;
                background: var(--fts-dark) !important;
                color: #fff !important;
                padding: 6px 14px !important;
                border-radius: 10px !important;
                font-size: 13px !important;
                font-weight: 600 !important;
                white-space: nowrap !important;
                opacity: 0 !important;
                transform: translateX(10px) !important;
                transition: all 0.3s ease !important;
                pointer-events: none !important;
                direction: ltr !important;
            }

            .fts-tooltip::after {
                content: '' !important;
                position: absolute !important;
                right: -5px !important;
                top: 50% !important;
                transform: translateY(-50%) !important;
                border-top: 5px solid transparent !important;
                border-bottom: 5px solid transparent !important;
                border-left: 5px solid var(--fts-dark) !important;
            }

            .fts-chat-option:hover .fts-tooltip {
                opacity: 1 !important;
                transform: translateX(0) !important;
            }

            /* Pulsing Dot for Live Chat */
            .fts-option-pulse {
                position: absolute !important;
                top: 5px !important;
                right: 5px !important;
                width: 10px !important;
                height: 10px !important;
                background: #fff !important;
                border-radius: 50% !important;
                animation: ftsOptionPulse 2s infinite !important;
            }

            @keyframes ftsOptionPulse {
                0% { box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.8); }
                70% { box-shadow: 0 0 0 8px rgba(255, 255, 255, 0); }
                100% { box-shadow: 0 0 0 0 rgba(255, 255, 255, 0); }
            }

            /* Responsive Adjustments */
            @media (max-width: 768px) {
                .fts-modern-chat-hub {
                    bottom: calc(110px + env(safe-area-inset-bottom)) !important;
                    right: 20px !important;
                }
                .fts-chat-main-trigger {
                    width: 55px !important;
                    height: 55px !important;
                }
                .fts-chat-option {
                    width: 45px !important;
                    height: 45px !important;
                }
                .fts-tooltip {
                    font-size: 12px !important;
                    padding: 6px 12px !important;
                    right: 60px !important;
                }
            }
        </style>
        <?php
    }

    public function render_trigger() {
        if ( function_exists( 'is_singular' ) && is_singular( 'trip' ) ) {
            return;
        }
        $whatsapp_number = apply_filters( 'fts_whatsapp_number', '201000479285' );
        $wa_number = preg_replace( '/[^0-9]/', '', (string) $whatsapp_number );
        $wa_href = $wa_number !== '' ? ( 'https://wa.me/' . $wa_number ) : '';
        ?>
        <!-- Modern Floating Chat Hub -->
        <div class="fts-modern-chat-hub" id="ftsChatHub">
            
            <!-- Expanded Options -->
            <div class="fts-chat-options">
                <!-- WhatsApp Option -->
                <?php if ( $wa_href ) : ?>
                <a href="<?php echo esc_url( $wa_href ); ?>" target="_blank" rel="noopener" class="fts-chat-option whatsapp">
                    <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><path fill="currentColor" d="M19.11 17.21c-.29-.15-1.71-.84-1.98-.93-.27-.1-.47-.15-.67.15-.2.29-.77.93-.95 1.12-.17.2-.35.22-.64.07-.29-.15-1.24-.46-2.36-1.46-.87-.78-1.45-1.75-1.62-2.05-.17-.29-.02-.45.13-.6.14-.14.29-.35.44-.52.15-.17.2-.29.29-.49.1-.2.05-.37-.02-.52-.07-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.5-.17 0-.37-.02-.57-.02-.2 0-.52.07-.79.37-.27.29-1.04 1.02-1.04 2.49s1.07 2.89 1.22 3.09c.15.2 2.11 3.22 5.12 4.52.72.31 1.28.5 1.71.64.72.23 1.37.2 1.88.12.57-.08 1.71-.7 1.95-1.38.24-.67.24-1.24.17-1.38-.07-.14-.27-.22-.57-.37z"/><path fill="currentColor" d="M16.01 3.2c-7.07 0-12.8 5.73-12.8 12.8 0 2.25.59 4.44 1.72 6.38L3.1 28.8l6.57-1.72c1.88 1.03 4 1.57 6.15 1.57 7.07 0 12.8-5.73 12.8-12.8S23.08 3.2 16.01 3.2zm0 23.12c-1.97 0-3.9-.53-5.59-1.54l-.4-.24-3.9 1.02 1.04-3.79-.26-.39a10.53 10.53 0 0 1-1.66-5.7c0-5.83 4.74-10.56 10.56-10.56 5.83 0 10.56 4.74 10.56 10.56 0 5.83-4.74 10.56-10.56 10.56z"/></svg>
                    <span class="fts-tooltip">WhatsApp</span>
                </a>
                <?php endif; ?>

                <!-- Live Chat Option -->
                <div class="fts-chat-option live-chat" onclick="ftsToggleTawk()">
                    <div class="fts-option-pulse"></div>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"></path></svg>
                    <span class="fts-tooltip">Live Chat</span>
                </div>
            </div>

            <!-- Main Hub Trigger -->
            <div class="fts-chat-main-trigger" onclick="ftsToggleHub()">
                <div class="fts-icon-container">
                    <svg class="main-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"></path></svg>
                    <svg class="close-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M18 6 6 18"></path><path d="M6 6 18 18"></path></svg>
                </div>
            </div>
        </div>

        <script>
            function ftsToggleHub() {
                const hub = document.getElementById('ftsChatHub');
                hub.classList.toggle('active');
            }

            function ftsToggleTawk() {
                if (typeof Tawk_API !== 'undefined') {
                    // Close hub after clicking option
                    document.getElementById('ftsChatHub').classList.remove('active');
                    Tawk_API.toggle();
                }
            }

            // Close hub on outside click
            document.addEventListener('click', function(event) {
                const hub = document.getElementById('ftsChatHub');
                const isClickInside = hub.contains(event.target);
                if (!isClickInside && hub.classList.contains('active')) {
                    hub.classList.remove('active');
                }
            });
        </script>
        <?php
    }

    public function render_tawk_script() {
        if ( function_exists( 'is_singular' ) && is_singular( 'trip' ) ) {
            return;
        }
        ?>
        <!--Start of Tawk.to Script-->
        <script type="text/javascript">
        var Tawk_API=Tawk_API||{}, Tawk_LoadStart=new Date();
        
        /* Hide Default Widget Launcher */
        Tawk_API.onLoad = function(){
            Tawk_API.hideWidget();
        };

        (function(){
            var s1=document.createElement("script"),s0=document.getElementsByTagName("script")[0];
            s1.async=true;
            s1.src='https://embed.tawk.to/68ff581bd6c35b19500effa8/1j8in0b8n';
            s1.charset='UTF-8';
            s1.setAttribute('crossorigin','*');
            s0.parentNode.insertBefore(s1,s0);
        })();
        </script>
        <!--End of Tawk.to Script-->
        <?php
    }
}

new FTS_Live_Chat();
