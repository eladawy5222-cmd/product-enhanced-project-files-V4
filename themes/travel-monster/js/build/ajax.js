(function ($) {

    //Start Ajax Pagination
    var pageNum, max, nextLink, autoLoad, loading_posts, last_post, lastPostVisible, load_html, moreBlocks;

    pageNum = parseInt(travel_monster_ajax.startPage) + 1;
    max = parseInt(travel_monster_ajax.maxPages);
    nextLink = travel_monster_ajax.nextLink;
    autoLoad = travel_monster_ajax.autoLoad;

    if (autoLoad == 'load_more') {
        // Insert the "Load More Posts" link.
        $('.ajax-pagination')
            .before('<div class="pagination_holder" style="display: none;"></div>')
            .after('<div id="load-posts"><a href="javascript:void(0);"><i class="fas fa-sync-alt"></i>' + travel_monster_ajax.loadmore + '</a></div>');
        if (pageNum == max + 1) {
            $('#load-posts a').html('<i class="fas fa-ban"></i>' + travel_monster_ajax.nomore).addClass('disabled');
        }
        $('#load-posts a').on('click', function () {
            if (pageNum <= max && !$(this).hasClass('loading')) {
                $(this).html('<i class="fas fa-sync-alt fa-spinner"></i>' + travel_monster_ajax.loading).addClass('loading');
                $('.pagination_holder').load(nextLink + ' .latest_post', function () {
                    // Update page number and nextLink.
                    pageNum++;
                    var new_url = nextLink;
                    nextLink = nextLink.replace(/(\/?)page(\/|d=)[0-9]+/, '$1page$2' + pageNum);

                    //Temporary hold the post from pagination and append it to #main
                    var load_html = $('.pagination_holder').html();
                    $('.pagination_holder').html('');

                    if ($('.blog.masonry-layout').length > 0 || $('.search.masonry-layout').length > 0 || $('.archive.masonry-layout').length > 0) {
                        // Make jQuery object from HTML string
                        var $moreBlocks = $(load_html).filter('article.latest_post');
                        // Append new blocks to container
                        $('.site-main').append($moreBlocks).imagesLoaded(function () {
                            // Have Masonry position new blocks
                            $('.site-main').masonry('appended', $moreBlocks);
                        });
                    } else {
                        $('.site-main article:last').after(load_html); // just simply append content without massonry
                    }

                    var $this = $('.site-main').find('.entry-content').find('div');
                    if ($this.hasClass('tiled-gallery')) {
                        $.getScript(travel_monster_ajax.plugin_url + "/jetpack/modules/tiled-gallery/tiled-gallery/tiled-gallery.js");
                    }

                    if (pageNum <= max) {
                        $('#load-posts a').html('<i class="fas fa-sync-alt"></i>' + travel_monster_ajax.loadmore).removeClass('loading');
                    } else {
                        $('#load-posts a').html('<i class="fas fa-ban"></i>' + travel_monster_ajax.nomore).addClass('disabled').removeClass('loading');
                    }
                });

            } else {
                // no more posts
            }

            return false;
        });
        $('.ajax-pagination').remove();
    } else if (autoLoad == 'infinite_scroll') {
        // autoload

        // Placeholder
        $('.ajax-pagination').before('<div class="pagination_holder" style="display: none;"></div>');

        loading_posts = false;
        last_post = false;

        if ($('.blog').length > 0 || $('.search').length > 0 || $('.archive').length > 0) {
            $(window).scroll(function () {
                if (!loading_posts && !last_post) {
                    lastPostVisible = $('.travel-monster-post').last().travel_monsterIsOnScreen();
                    if (lastPostVisible) {
                        if (pageNum <= max) {
                            loading_posts = true;

                            $('.pagination_holder').load(nextLink + ' .travel-monster-post', function () {
                                // Update page number and nextLink.
                                pageNum++;

                                loading_posts = false;
                                nextLink = nextLink.replace(/(\/?)page(\/|d=)[0-9]+/, '$1page$2' + pageNum);

                                //Temporary hold the post from pagination and append it to #main
                                load_html = $('.pagination_holder').html();
                                $('.pagination_holder').html('');
                            });

                        } else {
                            // no more posts
                            last_post = true;
                        }
                    }
                }
            });
        }

        $('.pagination').remove();
    }
}(jQuery));