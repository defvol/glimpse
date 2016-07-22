glimpse
=
a news reader for the PlayBook tablet
-

![TechRepublic](https://raw.githubusercontent.com/rodowi/glimpse/master/screenshot.jpg)

_Top 10 PlayBook apps after one week on the market - TechRepublic_

History
-
This project started at [Teiga][] in the last days of February 2011 with the goal of participating in RIM's [Free Playbook Offer][].

The app went online on March 31 and had great reviews in the months following the release. The project got mentioned in [TechRepublic] and [ZDNet].

> *Glimpse is a slick RSS reader that lets you view your RSS feeds in a cool interface* - Top 10 PlayBook apps after one week on the market @ [TechRepublic][]

But now we decided to release it as open source with the intention of building a community to support its free development.

---

The inner workings
-
The basic idea behind [Glimpse][] is to display the latest news from your favorite sources in a picture grid akin to a photo gallery.

**Feeds**. To handle the irritating differences (and lack of standards) in web feeds, we decided to work on top of the [Google Feed API][], which abstracts all the RSS and ATOM parsing for us.

**Storage**. An easy one. We used HTML5 offline storage capabilities to pull this one out.

**Google Reader Support**. To overcome the cross-domain issues in Webworks, we hack around the AIR wrapper class, which connects web code with native code. To see Google Reader related code, please check [wilhelmbot][]’s [open-gReader][] project.

Installation
-
1. $ git clone
2. $ ./appworld.sh  
3. Edit deployment scripts and build  
3.1 $ ./compile-n-deploy.sh app [playbook-ip] or  
3.2 $ ./sign-n-deploy.sh app [playbook-ip] \[build-no\]

TODO  
-
* Translate JS code to a robust MVC framework, such as SproutCore, Cappuccino or Backbone.  
* Make a full-installation script  
* Better documentation  
* Transitions improvement. CSS-3 transformations over jQuery.

[Teiga]: http://teiga.mx/ "Teiga"
[Free Playbook Offer]: http://us.blackberry.com/developers/tablet/playbook_offer.jsp "Free Playbook Offer"
[Glimpse]: http://glimpse.teiga.mx/ "Glimpse"
[Google Feed API]: http://code.google.com/apis/feed/ "Google Feed API"
[TechRepublic]: http://tek.io/lT8wRj "TechRepublic"
[ZDNet]: http://zd.net/lt6nRW "ZDNet"
[wilhelmbot]: https://github.com/wilhelmbot "wilhelmbot"
[open-gReader]: https://github.com/wilhelmbot/open-gReader "open-gReader"
